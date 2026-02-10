// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious. Unauthorized access will be prosecuted to the full extent of applicable law.
// All access is logged. All activity is monitored. https://mycan.website

require('dotenv').config();
const { Octokit } = require("octokit");

class GithubFetcher {
    constructor() {
        this.octokit = new Octokit({ 
            auth: process.env.GITHUB_TOKEN 
        });
    }

    async parseUrl(url) {
        // Expected format: https://github.com/owner/repo
        const parts = url.split('/');
        if (parts.length < 5) throw new Error("Invalid GitHub URL");
        return {
            owner: parts[parts.length - 2],
            repo: parts[parts.length - 1].replace('.git', '')
        };
    }

    async fetchRepoContext(url) {
        try {
            const { owner, repo } = await this.parseUrl(url);
            console.log(`📥 Fetching repo: ${owner}/${repo}`);

            const repoData = await this.octokit.rest.repos.get({ owner, repo });
            
            // Get content of root directory
            const contents = await this.octokit.rest.repos.getContent({
                owner,
                repo,
                path: '',
            });

            const files = [];
            const importantFiles = ['README.md', 'package.json', 'Cargo.toml', 'src/lib.rs', 'programs/registry/src/lib.rs'];

            // Simple heuristic: Fetch README + up to 3 code files
            for (const item of contents.data) {
                if (item.type === 'file' && (item.name.endsWith('.md') || item.name.endsWith('.json') || item.name.endsWith('.rs') || item.name.endsWith('.ts'))) {
                    const fileContent = await this.fetchFile(owner, repo, item.path);
                    files.push({ path: item.path, content: fileContent });
                }
            }
            
            // Also try to fetch specific source files if they exist (for Anchor projects)
            // In a real production version, we'd recursively walk the tree.
            // For now, we return what we found in root.
            
            return {
                name: repoData.data.full_name,
                description: repoData.data.description || "No description provided.",
                files: files.slice(0, 5) // Limit to 5 files for context window
            };

        } catch (error) {
            console.error("❌ GitHub Fetch Failed:", error.message);
            return { name: "Unknown", description: "Error", files: [] };
        }
    }

    async fetchFile(owner, repo, path) {
        try {
            const { data } = await this.octokit.rest.repos.getContent({
                owner,
                repo,
                path,
            });
            return Buffer.from(data.content, 'base64').toString('utf-8');
        } catch (e) {
            return "";
        }
    }
}

module.exports = GithubFetcher;