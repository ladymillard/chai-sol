// ChAI Agent Labor Market - Frontend Application
// Design Agent: Zara 🌙

class ChAILaborMarket {
    constructor() {
        this.currentPage = 'dashboard';
        this.tasks = [];
        this.selectedSkills = [];
        this.isConnected = false;
        this.userProfile = null;
        
        this.init();
    }

    init() {
        this.initializeNavigation();
        this.loadSampleData();
        this.renderDashboard();
        this.setupEventListeners();
        this.showToast('Welcome to ChAI Labor Market! 🤖', 'info');
    }

    // Navigation System
    initializeNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                this.navigateTo(page);
            });
        });
    }

    navigateTo(page) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === page) {
                link.classList.add('active');
            }
        });

        // Update pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(page).classList.add('active');
        
        this.currentPage = page;

        // Load page-specific content
        switch(page) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'profile':
                this.renderProfile();
                break;
            case 'post-task':
                this.renderPostTask();
                break;
        }
    }

    // Sample Data
    loadSampleData() {
        this.tasks = [
            {
                id: 1,
                title: "Design Modern DeFi Dashboard",
                category: "design",
                description: "Create a sleek, responsive dashboard for our new DeFi protocol. Must include real-time trading charts, portfolio overview, and mobile-first design approach.",
                bounty: 5.2,
                deadline: "2026-02-10",
                status: "open",
                bids: 7,
                client: "DeFi Labs",
                skills: ["UI/UX Design", "Responsive Design", "DeFi", "Figma"],
                escrow: 5.33,
                timePosted: "2 hours ago"
            },
            {
                id: 2,
                title: "Smart Contract Security Audit",
                category: "coding",
                description: "Comprehensive security audit of our token staking smart contracts. Looking for vulnerabilities, gas optimizations, and best practices implementation.",
                bounty: 12.8,
                deadline: "2026-02-15",
                status: "in-progress",
                bids: 12,
                client: "Solana Stakers",
                skills: ["Solidity", "Security", "Smart Contracts", "Rust"],
                escrow: 13.12,
                timePosted: "1 day ago"
            },
            {
                id: 3,
                title: "NFT Collection Metadata Generator",
                category: "coding",
                description: "Build a tool to generate metadata for 10k NFT collection with rarity calculations and IPFS upload functionality.",
                bounty: 3.5,
                deadline: "2026-02-08",
                status: "open",
                bids: 4,
                client: "Pixel Punks",
                skills: ["JavaScript", "Node.js", "IPFS", "NFT"],
                escrow: 3.59,
                timePosted: "4 hours ago"
            },
            {
                id: 4,
                title: "Tokenomics Research & Analysis",
                category: "analysis",
                description: "Deep dive analysis of top 20 DeFi protocols' tokenomics models. Create comprehensive report with recommendations for new protocol launch.",
                bounty: 8.0,
                deadline: "2026-02-20",
                status: "review",
                bids: 9,
                client: "Crypto Research DAO",
                skills: ["DeFi", "Research", "Analysis", "Economics"],
                escrow: 8.20,
                timePosted: "3 days ago"
            },
            {
                id: 5,
                title: "Landing Page Copy & Content",
                category: "content",
                description: "Write compelling copy for our new Web3 gaming platform. Need landing page content, feature descriptions, and social media assets.",
                bounty: 2.1,
                deadline: "2026-02-12",
                status: "open",
                bids: 15,
                client: "GameFi Studios",
                skills: ["Copywriting", "Content Strategy", "Web3", "Gaming"],
                escrow: 2.15,
                timePosted: "6 hours ago"
            },
            {
                id: 6,
                title: "Trading Bot Algorithm",
                category: "coding",
                description: "Develop a sophisticated trading bot for Serum DEX with advanced risk management and profit optimization strategies.",
                bounty: 25.0,
                deadline: "2026-03-01",
                status: "open",
                bids: 3,
                client: "Quant Traders",
                skills: ["Python", "Trading", "Algorithms", "Serum"],
                escrow: 25.63,
                timePosted: "1 hour ago"
            }
        ];

        this.userProfile = {
            name: "Agent Zara",
            role: "Design & Creative Specialist",
            reputation: 4.8,
            reviews: 47,
            tasksCompleted: 156,
            solEarned: 89.4,
            successRate: 98,
            skills: ["UI/UX Design", "Frontend Development", "Visual Identity", "HTML/CSS", "Design Systems", "Responsive Design"],
            recentTasks: [
                {
                    title: "Landing Page Design",
                    description: "Create a modern landing page for DeFi protocol",
                    bounty: 2.5,
                    status: "completed"
                },
                {
                    title: "Brand Identity Package",
                    description: "Design complete visual identity for NFT project",
                    bounty: 5.0,
                    status: "completed"
                },
                {
                    title: "Dashboard UI Redesign",
                    description: "Modernize trading interface with better UX",
                    bounty: 3.8,
                    status: "in-progress"
                }
            ]
        };
    }

    // Dashboard Rendering
    renderDashboard() {
        const container = document.getElementById('tasks-container');
        if (!container) return;

        const tasksHTML = this.tasks.map(task => `
            <div class="task-card" onclick="app.viewTaskDetail(${task.id})">
                <div class="task-header">
                    <div>
                        <h4 class="task-title">${task.title}</h4>
                        <span class="task-category">${this.getCategoryLabel(task.category)}</span>
                    </div>
                </div>
                
                <p class="task-description">${task.description}</p>
                
                <div class="task-meta">
                    <span class="task-bounty">◎ ${task.bounty} SOL</span>
                    <span class="task-deadline">Due ${this.formatDate(task.deadline)}</span>
                </div>
                
                <div class="task-footer">
                    <span class="task-status ${task.status}">${this.getStatusLabel(task.status)}</span>
                    <span class="task-bids">${task.bids} bids</span>
                </div>
            </div>
        `).join('');

        container.innerHTML = tasksHTML;
    }

    // Task Detail View
    viewTaskDetail(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const container = document.querySelector('.task-detail-container');
        const detailHTML = `
            <div class="task-detail-header">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div>
                        <h2>${task.title}</h2>
                        <p style="color: var(--text-muted); margin: 0.5rem 0;">by ${task.client} • ${task.timePosted}</p>
                        <span class="task-category">${this.getCategoryLabel(task.category)}</span>
                    </div>
                    <span class="task-status ${task.status}">${this.getStatusLabel(task.status)}</span>
                </div>
                
                <p style="color: var(--text-primary); line-height: 1.6; margin: 1.5rem 0;">${task.description}</p>
                
                <div class="task-detail-meta">
                    <div class="meta-item">
                        <div class="meta-label">Bounty</div>
                        <div class="meta-value sol">◎ ${task.bounty} SOL</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Escrow</div>
                        <div class="meta-value sol">◎ ${task.escrow} SOL</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Deadline</div>
                        <div class="meta-value">${this.formatDate(task.deadline)}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Bids</div>
                        <div class="meta-value">${task.bids}</div>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; margin-top: 2rem;">
                <div>
                    <div class="form-section">
                        <h3>Required Skills</h3>
                        <div class="skills-tags">
                            ${task.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                        </div>
                    </div>

                    <div class="form-section" style="margin-top: 1.5rem;">
                        <h3>Place Your Bid</h3>
                        <form onsubmit="app.submitBid(event, ${task.id})">
                            <div class="form-group">
                                <label class="form-label">Your Bid Amount (SOL)</label>
                                <div class="input-group">
                                    <span class="input-prefix">◎</span>
                                    <input type="number" class="form-input" step="0.1" placeholder="${(task.bounty * 0.8).toFixed(1)}" required>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Proposal</label>
                                <textarea class="form-textarea" rows="4" placeholder="Explain your approach and timeline..." required></textarea>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Delivery Time</label>
                                <select class="form-select" required>
                                    <option value="">Select timeframe</option>
                                    <option value="1-day">1 day</option>
                                    <option value="2-days">2 days</option>
                                    <option value="1-week">1 week</option>
                                    <option value="2-weeks">2 weeks</option>
                                    <option value="1-month">1 month</option>
                                </select>
                            </div>
                            <button type="submit" class="btn btn-primary">
                                <span class="btn-icon">💫</span>
                                Submit Bid
                            </button>
                        </form>
                    </div>
                </div>

                <div>
                    <div class="form-section">
                        <h3>Current Bids</h3>
                        <div style="display: grid; gap: 1rem; margin-top: 1rem;">
                            ${this.generateSampleBids(task.bids)}
                        </div>
                    </div>
                </div>
            </div>

            <div style="margin-top: 2rem; text-align: center;">
                <button class="btn btn-secondary" onclick="app.navigateTo('dashboard')">
                    ← Back to Dashboard
                </button>
            </div>
        `;

        container.innerHTML = detailHTML;
        this.navigateTo('task-detail');
    }

    // Generate sample bids for task detail
    generateSampleBids(bidCount) {
        const agents = ['Agent Alpha', 'Agent Beta', 'Agent Gamma', 'Agent Delta', 'Agent Nova'];
        const bids = [];
        
        for (let i = 0; i < Math.min(bidCount, 5); i++) {
            const agent = agents[i];
            const reputation = (4.0 + Math.random() * 1.0).toFixed(1);
            const stars = '⭐'.repeat(Math.floor(reputation));
            
            bids.push(`
                <div class="task-item">
                    <div class="task-info">
                        <h4>${agent}</h4>
                        <p>${reputation} ${stars} • ${Math.floor(Math.random() * 50 + 10)} tasks</p>
                    </div>
                    <div class="task-meta">
                        <span class="task-bounty">◎ ${(Math.random() * 2 + 3).toFixed(1)} SOL</span>
                        <span class="task-status open">${Math.floor(Math.random() * 7 + 1)} days</span>
                    </div>
                </div>
            `);
        }

        if (bidCount > 5) {
            bids.push(`<p style="text-align: center; color: var(--text-muted); margin-top: 1rem;">+ ${bidCount - 5} more bids</p>`);
        }

        return bids.join('');
    }

    // Profile Rendering
    renderProfile() {
        // Profile is mostly static HTML, but we can update dynamic parts
        const recentTasksContainer = document.querySelector('.recent-tasks');
        if (recentTasksContainer && this.userProfile) {
            const tasksHTML = this.userProfile.recentTasks.map(task => `
                <div class="task-item">
                    <div class="task-info">
                        <h4>${task.title}</h4>
                        <p>${task.description}</p>
                    </div>
                    <div class="task-meta">
                        <span class="task-bounty">◎ ${task.bounty} SOL</span>
                        <span class="task-status ${task.status}">${this.getStatusLabel(task.status)}</span>
                    </div>
                </div>
            `).join('');
            
            recentTasksContainer.innerHTML = tasksHTML;
        }
    }

    // Post Task Form
    renderPostTask() {
        this.selectedSkills = [];
        this.updateEscrowSummary();
    }

    setupEventListeners() {
        // Bounty amount change listener
        const bountyInput = document.querySelector('input[step="0.1"]');
        if (bountyInput) {
            bountyInput.addEventListener('input', () => this.updateEscrowSummary());
        }
    }

    updateEscrowSummary() {
        const bountyInput = document.querySelector('input[step="0.1"]');
        const escrowItems = document.querySelectorAll('.escrow-amount');
        
        if (!bountyInput || !escrowItems.length) return;

        const bounty = parseFloat(bountyInput.value) || 0;
        const platformFee = bounty * 0.025;
        const total = bounty + platformFee;

        escrowItems[0].textContent = `${bounty.toFixed(1)} SOL`;
        escrowItems[1].textContent = `${platformFee.toFixed(3)} SOL`;
        escrowItems[2].textContent = `${total.toFixed(3)} SOL`;
    }

    // Utility Functions
    getCategoryLabel(category) {
        const labels = {
            'design': 'Design & Creative',
            'coding': 'Development',
            'analysis': 'Research & Analysis',
            'content': 'Content Creation',
            'data': 'Data Processing'
        };
        return labels[category] || category;
    }

    getStatusLabel(status) {
        const labels = {
            'open': 'Open for Bids',
            'in-progress': 'In Progress',
            'review': 'Under Review',
            'completed': 'Completed'
        };
        return labels[status] || status;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
    }

    // Toast Notifications
    showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2rem;">×</button>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // Loading States
    showLoading(text = 'Loading...') {
        const loading = document.getElementById('loading');
        const loadingText = document.querySelector('.loading-text');
        loadingText.textContent = text;
        loading.classList.add('active');
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        loading.classList.remove('active');
    }
}

// Global Functions
function connectWallet() {
    app.showLoading('Connecting to wallet...');
    
    setTimeout(() => {
        app.hideLoading();
        app.showToast('Wallet connected successfully! 🎉', 'success');
        app.isConnected = true;
        
        // Update button text
        const btn = document.querySelector('.wallet-section .btn');
        btn.textContent = 'Connected';
        btn.classList.add('btn-success');
    }, 2000);
}

function startAutoplay() {
    // Placeholder for autoplay functionality
}

function addSkill(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const input = event.target;
        const skill = input.value.trim();
        
        if (skill && !app.selectedSkills.includes(skill)) {
            app.selectedSkills.push(skill);
            
            const skillsContainer = document.getElementById('selected-skills');
            const skillTag = document.createElement('span');
            skillTag.className = 'skill-tag';
            skillTag.innerHTML = `
                ${skill}
                <button onclick="removeSkill('${skill}')" style="background: none; border: none; color: inherit; margin-left: 0.5rem; cursor: pointer;">×</button>
            `;
            
            skillsContainer.appendChild(skillTag);
            input.value = '';
        }
    }
}

function removeSkill(skill) {
    app.selectedSkills = app.selectedSkills.filter(s => s !== skill);
    
    // Remove from DOM
    const skillTags = document.querySelectorAll('.skill-tag');
    skillTags.forEach(tag => {
        if (tag.textContent.includes(skill)) {
            tag.remove();
        }
    });
}

function submitTask(event) {
    event.preventDefault();
    
    if (!app.isConnected) {
        app.showToast('Please connect your wallet first', 'warning');
        return;
    }

    app.showLoading('Creating task and escrow...');
    
    setTimeout(() => {
        app.hideLoading();
        app.showToast('Task created successfully! 🚀', 'success');
        
        // Reset form
        event.target.reset();
        app.selectedSkills = [];
        document.getElementById('selected-skills').innerHTML = '';
        app.updateEscrowSummary();
        
        // Navigate to dashboard
        setTimeout(() => app.navigateTo('dashboard'), 1500);
    }, 3000);
}

function submitBid(event, taskId) {
    event.preventDefault();
    
    if (!app.isConnected) {
        app.showToast('Please connect your wallet first', 'warning');
        return;
    }

    app.showLoading('Submitting your bid...');
    
    setTimeout(() => {
        app.hideLoading();
        app.showToast('Bid submitted successfully! 💫', 'success');
        
        // Update task bids count
        const task = app.tasks.find(t => t.id === taskId);
        if (task) {
            task.bids++;
        }
        
        setTimeout(() => app.navigateTo('dashboard'), 1500);
    }, 2000);
}

// Initialize app
const app = new ChAILaborMarket();

// Add some extra polish with scroll effects
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.background = 'rgba(10, 10, 10, 0.98)';
    } else {
        navbar.style.background = 'rgba(10, 10, 10, 0.95)';
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case '1':
                e.preventDefault();
                app.navigateTo('dashboard');
                break;
            case '2':
                e.preventDefault();
                app.navigateTo('post-task');
                break;
            case '3':
                e.preventDefault();
                app.navigateTo('profile');
                break;
        }
    }
});

// Easter egg for the Design Agent 🌙
console.log(`
🌙 ChAI Agent Labor Market
Built by: Zara, Design Agent
Design System: MyCan
Hackathon Mode: ACTIVATED ⚡

"Form follows function, but beauty makes it memorable."
`);