import axios, { AxiosError } from "axios";
import type { Probot } from "probot";
import { inspect } from "util";
import {
	CLOUDFLARE_API_CONFIG,
	CLOUDFLARE_API_DNS,
	CLOUDFLARE_ZONES_RESPONSE,
	VERCEL_API_CONFIG,
	VERCEL_API_DEPLOY,
	VERCEL_API_DOMAIN
} from "./constants";

export = (app: Probot) => {
	app.on(["pull_request.opened", "pull_request.reopened"], async (context) => {
		const pr = context.pullRequest({});
		if (pr.owner !== "stereo-bot" || pr.repo !== "website") return;

		const creator = context.payload.sender.login;
		const prNumber = pr.pull_number as number;
		const {
			ref: branch,
			user: { login: org },
			sha,
			repo: { name: repo }
		} = context.payload.pull_request.head;

		let domain: string;
		if (context.payload.pull_request.head.repo.fork) domain = `https://website-git-fork-${creator}-${branch}-stereo-bot.vercel.app`;
		else domain = await createDNS(prNumber, branch, org, sha, repo);

		let body: string;
		if (context.payload.sender.login === "stereobot" && context.payload.pull_request.head.ref === "chore/crowdin-translations") {
			body = [
				`🔤 New translations just arrived! Make sure to double check if all translations work seamlessly with the website using [this link ↗︎](${domain}).\n`,
				`❗Remember that the the deployment of this preview build may take a while depending on the queue size, you will receive a message from **Vercel** when the build is completed.`
			].join("\n");

			await context.octokit.issues.addLabels({
				issue_number: prNumber,
				owner: pr.owner,
				repo: pr.repo,
				labels: ["Translations"]
			});
			await context.octokit.pulls.requestReviewers({
				pull_number: prNumber,
				owner: pr.owner,
				repo: pr.repo,
				reviewers: ["DaanGamesDG"]
			});
		} else
			body = [
				`${
					context.payload.action === "opened" ? `Hey @${creator} thanks for opening a PR.` : `Hey @${creator} thanks for reopening this PR.`
				} A new preview will be build and deployed momentarily, to view the build [click here ↗︎](${domain}).\n`,
				`❗Remember that the the deployment of this preview build may take a while depending on the queue size, you will receive a message from **Vercel** when the build is completed.`
			].join("\n");

		const issueComment = context.issue({
			body
		});
		await context.octokit.issues.createComment(issueComment);
	});

	app.on("pull_request.closed", async (context) => {
		const pr = context.pullRequest({});
		if (pr.owner !== "stereo-bot" || pr.repo !== "website") return;

		const creator = context.payload.sender.login;
		const prNumber = pr.pull_number as number;

		if (!context.payload.pull_request.head.repo.fork) await deleteDNS(prNumber);

		const issueComment = context.issue({
			body: context.payload.pull_request.merged
				? `@${creator} merged this PR 🎉 and the preview build is now deleted. To view the result [click here ↗︎](https://v3.stereo-bot.xyz)`
				: `@${creator} marked this PR as closed, the preview build is no longer available.`
		});
		await context.octokit.issues.createComment(issueComment);
	});
	// For more information on building apps:
	// https://probot.github.io/docs/

	// To get your app running against GitHub, see:
	// https://probot.github.io/docs/development/
};

const createDNS = async (prNumber: number, branch: string, org: string, sha: string, repo: string) => {
	const name = `pr-${prNumber}.dev.stereo-bot.xyz`;

	try {
		await axios.post(CLOUDFLARE_API_DNS, { type: "CNAME", name, content: "cname.vercel-dns.com", ttl: 1 }, CLOUDFLARE_API_CONFIG);
		await axios.post(`${VERCEL_API_DOMAIN}?teamId=${process.env.VERCEL_TEAM_ID}`, { name, gitBranch: branch }, VERCEL_API_CONFIG);
		await axios.post(
			`${VERCEL_API_DEPLOY}?teamId=${process.env.VERCEL_TEAM_ID}&forceNew=1&withCache=1`,
			{
				name: "website",
				gitSource: { org, ref: branch, repo, sha, type: "github" }
			},
			VERCEL_API_CONFIG
		);
	} catch (error) {
		console.error(inspect(error, false, 5));
	}

	return `https://pr-${prNumber}.dev.stereo-bot.xyz`;
};

const deleteDNS = async (prNumber: number) => {
	const name = `pr-${prNumber}.dev.stereo-bot.xyz`;

	try {
		const zone = (
			await axios.get<CLOUDFLARE_ZONES_RESPONSE>(`${CLOUDFLARE_API_DNS}?type=CNAME&name=${encodeURIComponent(name)}`, CLOUDFLARE_API_CONFIG)
		).data.result.find((res) => res.name === name);
		if (zone)
			await axios.delete(`${CLOUDFLARE_API_DNS}/${zone.id}`, CLOUDFLARE_API_CONFIG).catch((e: AxiosError) => {
				if (e.response?.status !== 404) throw e;
			});
		await axios.delete(`${VERCEL_API_DOMAIN}/${name}?teamId=${process.env.VERCEL_TEAM_ID}`, VERCEL_API_CONFIG).catch((e: AxiosError) => {
			if (e.response?.status !== 404) throw e;
		});
	} catch (error) {
		console.error(inspect(error, false, 5));
	}
};
