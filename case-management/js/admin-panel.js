class AdminPanel {
    constructor() {
        this.users = JSON.parse(localStorage.getItem('users')) || [];
        this.caseManagers = JSON.parse(localStorage.getItem('caseManagers')) || [];
        this.initializeEventListeners();
    }

    saveToStorage() {
        localStorage.setItem('users', JSON.stringify(this.users));
        localStorage.setItem('caseManagers', JSON.stringify(this.caseManagers));
    }

    addUser(userData) {
        const user = {
            id: Date.now().toString(36),
            ...userData,
            role: userData.role || 'user',
            createdAt: new Date().toISOString()
        };
        this.users.push(user);
        this.saveToStorage();
        return user;
    }

    updateUser(userId, updates) {
        const userIndex = this.users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            this.users[userIndex] = { ...this.users[userIndex], ...updates };
            this.saveToStorage();
            return this.users[userIndex];
        }
        return null;
    }

    removeUser(userId) {
        this.users = this.users.filter(u => u.id !== userId);
        this.saveToStorage();
    }

    addCaseManager(userData) {
        const caseManager = {
            id: Date.now().toString(36),
            ...userData,
            role: 'case_manager',
            createdAt: new Date().toISOString()
        };
        this.caseManagers.push(caseManager);
        this.saveToStorage();
        return caseManager;
    }

    removeCaseManager(caseManagerId) {
        this.caseManagers = this.caseManagers.filter(cm => cm.id !== caseManagerId);
        this.saveToStorage();
    }

    initializeEventListeners() {
        document.getElementById('adminPanelBtn').addEventListener('click', () => this.showAdminPanel());
    }

    showAdminPanel() {
        const modalHtml = `
            <div id="adminPanelModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
                <div class="relative top-20 mx-auto p-5 border w-3/4 shadow-lg rounded-lg bg-white">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-semibold text-gray-900">Admin Panel</h3>
                        <button class="modal-close text-gray-400 hover:text-gray-500">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="mb-8">
                        <h4 class="text-lg font-semibold mb-4">Case Managers</h4>
                        <div class="mb-4">
                            <form id="addCaseManagerForm" class="flex gap-4">
                                <input type="text" id="newCaseManagerName" placeholder="Name" required
                                       class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <input type="email" id="newCaseManagerEmail" placeholder="Email" required
                                       class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                    Add Case Manager
                                </button>
                            </form>
                        </div>
                        <div id="caseManagersList" class="space-y-2">
                            ${this.renderCaseManagers()}
                        </div>
                    </div>
                    <div>
                        <h4 class="text-lg font-semibold mb-4">Users</h4>
                        <div id="usersList" class="space-y-2">
                            ${this.renderUsers()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer.firstChild);

        this.initializeModalEventListeners();
    }

    renderCaseManagers() {
        return this.caseManagers.map(cm => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                    <p class="font-medium">${cm.name}</p>
                    <p class="text-sm text-gray-500">${cm.email}</p>
                </div>
                <button onclick="adminPanel.removeCaseManager('${cm.id}')" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    }

    renderUsers() {
        return this.users.map(user => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                    <p class="font-medium">${user.name}</p>
                    <p class="text-sm text-gray-500">${user.email}</p>
                </div>
                <div class="flex items-center gap-2">
                    <select onchange="adminPanel.updateUserRole('${user.id}', this.value)" 
                            class="px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                    <button onclick="adminPanel.removeUser('${user.id}')" class="text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    initializeModalEventListeners() {
        const modal = document.getElementById('adminPanelModal');
        const closeBtn = modal.querySelector('.modal-close');
        const addCaseManagerForm = document.getElementById('addCaseManagerForm');

        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        addCaseManagerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('newCaseManagerName').value;
            const email = document.getElementById('newCaseManagerEmail').value;
            
            this.addCaseManager({ name, email });
            document.getElementById('caseManagersList').innerHTML = this.renderCaseManagers();
            addCaseManagerForm.reset();
        });
    }

    updateUserRole(userId, newRole) {
        this.updateUser(userId, { role: newRole });
        document.getElementById('usersList').innerHTML = this.renderUsers();
    }
}

// Initialize the admin panel
const adminPanel = new AdminPanel();
