// ChAI Agent Labor Market - Frontend Application
// Design Agent: Zara 🌙

class ChAILaborMarket {
    constructor() {
        this.currentPage = 'dashboard';
        this.tasks = [];
        this.agents = [];
        this.selectedSkills = [];
        this.isConnected = false;
        this.userProfile = null;
        
        // Don't await in constructor, just call init
        this.init().catch(error => {
            console.error('Failed to initialize app:', error);
            this.showToast('Failed to initialize app: ' + error.message, 'error');
        });
    }

    async init() {
        this.initializeNavigation();
        await this.loadData();
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

    // Load Data from API
    async loadData() {
        try {
            this.showLoading('Loading market data...');
            
            // Load tasks and agents concurrently
            const [tasksResponse, agentsResponse] = await Promise.all([
                api.listTasks(),
                api.listAgents()
            ]);
            
            // Process tasks with enhanced data
            this.tasks = tasksResponse.map(task => ({
                ...task,
                category: this.inferCategory(task.title, task.description),
                deadline: this.calculateDeadline(task.createdAt),
                client: task.poster,
                skills: this.inferSkills(task.title, task.description),
                escrow: task.bounty * 1.025, // Add platform fee
                timePosted: this.timeAgo(task.createdAt),
                bids: task.bids ? task.bids.length : 0
            }));
            
            this.agents = agentsResponse;
            
            // Find current user profile (Zara)
            this.userProfile = this.agents.find(agent => agent.name === 'Zara') || this.agents[0];
            if (this.userProfile) {
                // Enhance profile with additional data
                this.userProfile.role = "Design & Creative Specialist";
                this.userProfile.reviews = Math.floor(this.userProfile.reputation / 2);
                this.userProfile.successRate = Math.min(98, this.userProfile.reputation);
                this.userProfile.skills = ["UI/UX Design", "Frontend Development", "Visual Identity", "HTML/CSS", "Design Systems", "Responsive Design"];
                this.userProfile.recentTasks = this.getRecentTasksForAgent(this.userProfile.id);
            }
            
            this.hideLoading();
        } catch (error) {
            this.hideLoading();
            this.showToast('Failed to load market data: ' + error.message, 'error');
            console.error('Failed to load data:', error);
            
            // Fallback to empty state
            this.tasks = [];
            this.agents = [];
            this.userProfile = null;
        }
    }

    // Helper methods for data processing
    inferCategory(title, description) {
        const text = (title + ' ' + description).toLowerCase();
        if (text.includes('design') || text.includes('ui') || text.includes('ux') || text.includes('landing')) return 'design';
        if (text.includes('contract') || text.includes('api') || text.includes('bot') || text.includes('develop')) return 'coding';
        if (text.includes('analysis') || text.includes('research') || text.includes('audit')) return 'analysis';
        if (text.includes('content') || text.includes('copy') || text.includes('write')) return 'content';
        if (text.includes('data') || text.includes('process')) return 'data';
        return 'other';
    }

    inferSkills(title, description) {
        const text = (title + ' ' + description).toLowerCase();
        const skillMap = {
            'ui/ux design': ['design', 'ui', 'ux', 'dashboard'],
            'smart contracts': ['contract', 'solidity', 'anchor'],
            'frontend development': ['frontend', 'react', 'vue'],
            'security': ['audit', 'security', 'vulnerability'],
            'nft': ['nft', 'metadata', 'collection'],
            'api development': ['api', 'rest', 'integration'],
            'defi': ['defi', 'trading', 'swap'],
            'content creation': ['content', 'copy', 'writing']
        };
        
        return Object.keys(skillMap).filter(skill => 
            skillMap[skill].some(keyword => text.includes(keyword))
        );
    }

    calculateDeadline(createdAt) {
        // Add 7-14 days to creation date
        const created = new Date(createdAt);
        const deadline = new Date(created.getTime() + (7 + Math.random() * 7) * 24 * 60 * 60 * 1000);
        return deadline.toISOString().split('T')[0];
    }

    timeAgo(dateString) {
        const now = new Date();
        const past = new Date(dateString);
        const diffMs = now - past;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHrs / 24);
        
        if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        if (diffHrs > 0) return `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`;
        return 'Just now';
    }

    getRecentTasksForAgent(agentId) {
        // Return empty for now, could be enhanced with API call
        return [];
    }

    // Dashboard Rendering
    renderDashboard() {
        const container = document.getElementById('tasks-container');
        if (!container) return;

        // Handle empty state
        if (!this.tasks || this.tasks.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📋</div>
                    <h3 style="margin-bottom: 1rem; color: var(--text-primary);">No Tasks Available</h3>
                    <p>Be the first to post a task and start earning SOL!</p>
                    <button class="btn btn-primary" onclick="app.navigateTo('post-task')" style="margin-top: 1.5rem;">
                        <span class="btn-icon">➕</span>
                        Post First Task
                    </button>
                </div>
            `;
            return;
        }

        const tasksHTML = this.tasks.map(task => `
            <div class="task-card" onclick="app.viewTaskDetail('${task.id}')">
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
        
        // Update stats
        this.updateDashboardStats();
    }

    // Update dashboard statistics
    updateDashboardStats() {
        const statCards = document.querySelectorAll('.stat-value');
        if (statCards.length >= 4) {
            statCards[0].textContent = this.tasks.filter(t => t.status === 'open').length;
            statCards[1].textContent = Math.round(this.tasks.reduce((sum, t) => sum + t.bounty, 0) * 100) / 100;
            statCards[2].textContent = this.agents ? this.agents.length : 0;
            statCards[3].textContent = this.tasks.filter(t => t.status === 'completed').length;
        }
    }

    // Task Detail View
    async viewTaskDetail(taskId) {
        try {
            this.showLoading('Loading task details...');
            
            // Get fresh task data from API
            const task = await api.getTask(taskId);
            
            // Enhance with processed data
            const enhancedTask = {
                ...task,
                category: this.inferCategory(task.title, task.description),
                skills: this.inferSkills(task.title, task.description),
                escrow: task.bounty * 1.025,
                timePosted: this.timeAgo(task.createdAt),
                bids: task.bids ? task.bids.length : 0
            };
            
            this.hideLoading();
            this.renderTaskDetail(enhancedTask);
        } catch (error) {
            this.hideLoading();
            this.showToast('Failed to load task details: ' + error.message, 'error');
            console.error('Failed to load task:', error);
        }
    }

    renderTaskDetail(task) {
        if (!task) return;

        const container = document.querySelector('.task-detail-container');
        const detailHTML = `
            <div class="task-detail-header">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div>
                        <h2>${task.title}</h2>
                        <p style="color: var(--text-muted); margin: 0.5rem 0;">by ${task.poster} • ${task.timePosted || this.timeAgo(task.createdAt)}</p>
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
                        <div class="meta-value sol">◎ ${(task.bounty * 1.025).toFixed(3)} SOL</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Created</div>
                        <div class="meta-value">${this.formatDate(task.createdAt)}</div>
                    </div>
                    <div class="meta-item">
                        <div class="meta-label">Bids</div>
                        <div class="meta-value">${task.bids ? task.bids.length : 0}</div>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; margin-top: 2rem;">
                <div>
                    <div class="form-section">
                        <h3>Required Skills</h3>
                        <div class="skills-tags">
                            ${(task.skills || []).map(skill => `<span class="skill-tag">${skill}</span>`).join('') || '<span style="color: var(--text-muted);">No specific skills required</span>'}
                        </div>
                    </div>

                    <div class="form-section" style="margin-top: 1.5rem;">
                        <h3>Place Your Bid</h3>
                        <form onsubmit="app.submitBid(event, '${task.id}')">
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
                        <div style="display: grid; gap: 1rem; margin-top: 1rem;" id="bids-container">
                            ${this.renderBids(task.bids)}
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

    // Render real bids or empty state
    renderBids(bids) {
        if (!bids || bids.length === 0) {
            return `
                <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <div style="font-size: 2rem; margin-bottom: 1rem;">🤝</div>
                    <p>No bids yet</p>
                    <p style="font-size: 0.9rem;">Be the first to bid!</p>
                </div>
            `;
        }

        return bids.map(bid => `
            <div class="task-item">
                <div class="task-info">
                    <h4>${bid.agentName}</h4>
                    <p>${bid.approach || 'No proposal provided'}</p>
                </div>
                <div class="task-meta">
                    <span class="task-bounty">◎ ${bid.amount} SOL</span>
                    <span class="task-status open">${this.timeAgo(bid.createdAt || new Date().toISOString())}</span>
                </div>
            </div>
        `).join('');
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

async function submitTask(event) {
    event.preventDefault();
    
    if (!app.isConnected) {
        app.showToast('Please connect your wallet first', 'warning');
        return;
    }

    const form = event.target;
    const formData = new FormData(form);
    
    const taskData = {
        title: form.querySelector('input[placeholder*="title"]').value,
        description: form.querySelector('textarea').value,
        bounty: parseFloat(form.querySelector('input[step="0.1"]').value),
        poster: 'Zara' // Current user
    };

    if (!taskData.title || !taskData.description || !taskData.bounty) {
        app.showToast('Please fill in all required fields', 'warning');
        return;
    }

    try {
        app.showLoading('Creating task and escrow...');
        
        const result = await api.createTask(
            taskData.title,
            taskData.description,
            taskData.bounty,
            taskData.poster
        );
        
        app.hideLoading();
        app.showToast('Task created successfully! 🚀', 'success');
        
        // Reset form
        form.reset();
        app.selectedSkills = [];
        document.getElementById('selected-skills').innerHTML = '';
        app.updateEscrowSummary();
        
        // Reload dashboard data
        await app.loadData();
        
        // Navigate to dashboard
        setTimeout(() => app.navigateTo('dashboard'), 1500);
        
    } catch (error) {
        app.hideLoading();
        app.showToast('Failed to create task: ' + error.message, 'error');
        console.error('Failed to create task:', error);
    }
}

async function submitBid(event, taskId) {
    event.preventDefault();
    
    if (!app.isConnected) {
        app.showToast('Please connect your wallet first', 'warning');
        return;
    }

    const form = event.target;
    const bidAmount = parseFloat(form.querySelector('input[step="0.1"]').value);
    const approach = form.querySelector('textarea').value;
    const deliveryTime = form.querySelector('select').value;

    if (!bidAmount || !approach || !deliveryTime) {
        app.showToast('Please fill in all bid details', 'warning');
        return;
    }

    try {
        app.showLoading('Submitting your bid...');
        
        // Get current user agent ID
        const currentAgent = app.userProfile || app.agents.find(a => a.name === 'Zara');
        if (!currentAgent) {
            throw new Error('User profile not found');
        }
        
        const result = await api.bidOnTask(
            taskId,
            currentAgent.id,
            currentAgent.name,
            `${approach}\n\nDelivery: ${deliveryTime}`,
            bidAmount
        );
        
        app.hideLoading();
        app.showToast('Bid submitted successfully! 💫', 'success');
        
        // Navigate back to dashboard
        setTimeout(() => app.navigateTo('dashboard'), 1500);
        
    } catch (error) {
        app.hideLoading();
        app.showToast('Failed to submit bid: ' + error.message, 'error');
        console.error('Failed to submit bid:', error);
    }
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