// Data management using localStorage
class CaseManager {
    constructor() {
        this.cases = JSON.parse(localStorage.getItem('cases')) || [];
        this.notes = JSON.parse(localStorage.getItem('notes')) || {};
        this.attachments = JSON.parse(localStorage.getItem('attachments')) || {};
        this.initializeFirebase();
        this.initializeRichTextEditors();
    }

    initializeFirebase() {
        this.auth = auth; // Using the exported auth from firebase-config.js
        
        // Set up auth state listener
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                this.handleUserSignIn(user);
            } else {
                this.handleUserSignOut();
            }
        });
    }

    initializeRichTextEditors() {
        // Initialize TinyMCE for case description
        tinymce.init({
            selector: '#caseDescription',
            height: 300,
            menubar: false,
            plugins: [
                'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                'insertdatetime', 'media', 'table', 'help', 'wordcount'
            ],
            toolbar: 'undo redo | formatselect | ' +
                'bold italic backcolor | alignleft aligncenter ' +
                'alignright alignjustify | bullist numlist outdent indent | ' +
                'removeformat | help',
        });

        // Initialize TinyMCE for notes
        tinymce.init({
            selector: '#newNote',
            height: 200,
            menubar: false,
            plugins: ['advlist', 'autolink', 'lists', 'link', 'charmap'],
            toolbar: 'undo redo | formatselect | bold italic | bullist numlist',
        });
    }

    handleUserSignIn(user) {
        const userAvatar = document.getElementById('userAvatar');
        const defaultAvatar = document.getElementById('defaultAvatar');
        const userName = document.getElementById('userName');
        const signInBtn = document.getElementById('signInBtn');
        const signOutBtn = document.getElementById('signOutBtn');
        const adminPanelBtn = document.getElementById('adminPanelBtn');

        userAvatar.src = user.photoURL;
        userAvatar.classList.remove('hidden');
        defaultAvatar.classList.add('hidden');
        userName.textContent = user.displayName;
        signInBtn.classList.add('hidden');
        signOutBtn.classList.remove('hidden');

        // Check if user is admin
        const adminUser = adminPanel.users.find(u => u.email === user.email && u.role === 'admin');
        if (adminUser) {
            adminPanelBtn.classList.remove('hidden');
        }
    }

    handleUserSignOut() {
        const userAvatar = document.getElementById('userAvatar');
        const defaultAvatar = document.getElementById('defaultAvatar');
        const userName = document.getElementById('userName');
        const signInBtn = document.getElementById('signInBtn');
        const signOutBtn = document.getElementById('signOutBtn');
        const adminPanelBtn = document.getElementById('adminPanelBtn');

        userAvatar.classList.add('hidden');
        defaultAvatar.classList.remove('hidden');
        userName.textContent = '';
        signInBtn.classList.remove('hidden');
        signOutBtn.classList.add('hidden');
        adminPanelBtn.classList.add('hidden');
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    async uploadAttachment(caseId, file) {
        try {
            if (file.size > 100 * 1024 * 1024) { // 100MB limit for B2
                throw new Error('File size must be less than 100MB');
            }

            // Upload to B2
            const b2Result = await uploadToB2(file);

            if (!this.attachments[caseId]) {
                this.attachments[caseId] = [];
            }

            const attachment = {
                id: this.generateId(),
                name: file.name,
                type: file.type,
                size: file.size,
                fileId: b2Result.fileId,
                downloadUrl: b2Result.downloadUrl,
                uploadedAt: new Date().toISOString(),
                uploadedBy: this.auth.currentUser?.email || 'anonymous'
            };

            this.attachments[caseId].push(attachment);
            this.saveToStorage();
            return attachment;
        } catch (error) {
            console.error('Error uploading attachment:', error);
            throw error;
        }
    }

    downloadAttachment(attachment) {
        window.open(attachment.downloadUrl, '_blank');
    }

    saveToStorage() {
        localStorage.setItem('cases', JSON.stringify(this.cases));
        localStorage.setItem('notes', JSON.stringify(this.notes));
        localStorage.setItem('attachments', JSON.stringify(this.attachments));
    }

    createCase(caseData) {
        const newCase = {
            id: this.generateId(),
            title: caseData.title,
            description: tinymce.get('caseDescription').getContent(),
            priority: caseData.priority,
            caseManager: caseData.caseManager,
            status: 'open',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: this.auth.currentUser?.email || 'anonymous'
        };
        this.cases.push(newCase);
        this.notes[newCase.id] = [];
        this.saveToStorage();
        return newCase;
    }

    updateCase(id, updates) {
        const caseIndex = this.cases.findIndex(c => c.id === id);
        if (caseIndex !== -1) {
            this.cases[caseIndex] = {
                ...this.cases[caseIndex],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.saveToStorage();
            return this.cases[caseIndex];
        }
        return null;
    }

    deleteCase(id) {
        this.cases = this.cases.filter(c => c.id !== id);
        delete this.notes[id];
        this.saveToStorage();
    }

    addNote(caseId, noteText) {
        const note = {
            id: this.generateId(),
            content: tinymce.get('newNote').getContent(),
            createdAt: new Date().toISOString(),
            createdBy: this.auth.currentUser?.email || 'anonymous'
        };
        if (!this.notes[caseId]) {
            this.notes[caseId] = [];
        }
        this.notes[caseId].push(note);
        this.saveToStorage();
        return note;
    }

    searchCases(query) {
        query = query.toLowerCase();
        return this.cases.filter(c => 
            c.title.toLowerCase().includes(query) ||
            c.description.toLowerCase().includes(query)
        );
    }
}

// UI Management
class UI {
    constructor(caseManager) {
        this.caseManager = caseManager;
        this.attachments = caseManager.attachments; // Reference to attachments
        this.initializeEventListeners();
        this.renderCases();
    }

    handleFileUpload = async (file, caseId) => {
        const uploadBtn = document.getElementById('uploadAttachmentBtn');
        const uploadText = uploadBtn.querySelector('.upload-text');
        const uploadProgress = uploadBtn.querySelector('.upload-progress');
        const progressDiv = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('uploadProgressBar');
        const statusText = document.getElementById('uploadStatus');

        try {
            // Disable upload button and show progress UI
            uploadBtn.disabled = true;
            uploadText.classList.add('hidden');
            uploadProgress.classList.remove('hidden');
            progressDiv.classList.remove('hidden');
            
            // Show initial status
            statusText.textContent = 'Preparing upload...';
            progressBar.style.width = '0%';

            // Upload the file
            const attachment = await this.caseManager.uploadAttachment(caseId, file);
            
            // Update progress to complete
            progressBar.style.width = '100%';
            statusText.textContent = 'Upload complete!';

            // Update attachments list in UI
            const attachmentsList = document.getElementById('attachmentsList');
            if (attachmentsList) {
                attachmentsList.innerHTML = this.renderAttachments(caseId);
            }

            // Reset UI after short delay
            setTimeout(() => {
                uploadBtn.disabled = false;
                uploadText.classList.remove('hidden');
                uploadProgress.classList.add('hidden');
                progressDiv.classList.add('hidden');
                document.getElementById('fileAttachment').value = '';
            }, 1500);

            return attachment;
        } catch (error) {
            // Show error in status
            statusText.textContent = `Error: ${error.message}`;
            progressBar.style.backgroundColor = '#ef4444'; // red-500

            // Reset UI after delay
            setTimeout(() => {
                uploadBtn.disabled = false;
                uploadText.classList.remove('hidden');
                uploadProgress.classList.add('hidden');
                progressDiv.classList.add('hidden');
            }, 3000);

            console.error('Error uploading file:', error);
        }
    }

    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await this.auth.signInWithPopup(provider);
            const user = result.user;
            
            // Add user to admin panel if not exists
            const existingUser = adminPanel.users.find(u => u.email === user.email);
            if (!existingUser) {
                adminPanel.addUser({
                    name: user.displayName,
                    email: user.email,
                    role: 'user'
                });
            }
        } catch (error) {
            console.error('Error signing in with Google:', error);
            throw error;
        }
    }

    async signOut() {
        try {
            await this.auth.signOut();
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    }

    initializeEventListeners() {
        // Sign in/out buttons
        document.getElementById('signInBtn').addEventListener('click', () => this.signInWithGoogle());
        document.getElementById('signOutBtn').addEventListener('click', () => this.signOut());

        // User menu dropdown
        document.getElementById('userMenuBtn').addEventListener('click', () => {
            const dropdown = document.getElementById('userDropdown');
            dropdown.classList.toggle('hidden');
        });

        // File upload button
        document.getElementById('uploadAttachmentBtn').addEventListener('click', async () => {
            const fileInput = document.getElementById('fileAttachment');
            if (fileInput.files.length > 0) {
                await this.handleFileUpload(fileInput.files[0], this.currentCaseId);
            }
        });

        // File input change
        document.getElementById('fileAttachment').addEventListener('change', (e) => {
            const fileInput = e.target;
            const uploadBtn = document.getElementById('uploadAttachmentBtn');
            uploadBtn.disabled = fileInput.files.length === 0;
        });
        // New Case Button
        document.getElementById('newCaseBtn').addEventListener('click', () => {
            this.showModal('newCaseModal');
        });

        // New Case Form
        document.getElementById('newCaseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = {
                title: document.getElementById('caseTitle').value,
                description: tinymce.get('caseDescription').getContent(),
                priority: document.getElementById('casePriority').value,
                caseManager: document.getElementById('caseManager').value
            };
            const newCase = this.caseManager.createCase(formData);
            this.hideModal('newCaseModal');
            this.renderCases();
            this.resetForm('newCaseForm');
        });

        // Search Input
        document.getElementById('searchInput').addEventListener('input', (e) => {
            const query = e.target.value;
            const filteredCases = query ? 
                this.caseManager.searchCases(query) : 
                this.caseManager.cases;
            this.renderCases(filteredCases);
        });

        // Close Modal Buttons
        document.querySelectorAll('.modal-close').forEach(button => {
            button.addEventListener('click', () => {
                const modal = button.closest('[id$="Modal"]');
                this.hideModal(modal.id);
            });
        });

        // New Note Form
        document.getElementById('newNoteForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const noteText = document.getElementById('newNote').value;
            const caseId = e.target.dataset.caseId;
            if (noteText && caseId) {
                const note = this.caseManager.addNote(caseId, noteText);
                this.renderNote(note, caseId);
                document.getElementById('newNote').value = '';
            }
        });
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('hidden');

        // If it's the new case modal, populate the case manager dropdown
        if (modalId === 'newCaseModal') {
            const caseManagerSelect = document.getElementById('caseManager');
            caseManagerSelect.innerHTML = '<option value="">Select Case Manager</option>';
            
            // Get case managers from admin panel
            adminPanel.caseManagers.forEach(cm => {
                const option = document.createElement('option');
                option.value = cm.email;
                option.textContent = cm.name;
                caseManagerSelect.appendChild(option);
            });
        }
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }

    resetForm(formId) {
        document.getElementById(formId).reset();
    }

    getPriorityClass(priority) {
        const classes = {
            low: 'bg-green-100 text-green-800',
            medium: 'bg-yellow-100 text-yellow-800',
            high: 'bg-red-100 text-red-800'
        };
        return classes[priority] || classes.low;
    }

    getStatusClass(status) {
        const classes = {
            open: 'bg-blue-100 text-blue-800',
            'in-progress': 'bg-purple-100 text-purple-800',
            closed: 'bg-gray-100 text-gray-800'
        };
        return classes[status] || classes.open;
    }

    renderCases(cases = this.caseManager.cases) {
        const casesGrid = document.getElementById('casesGrid');
        casesGrid.innerHTML = '';

        cases.forEach(case_ => {
            const caseElement = document.createElement('div');
            caseElement.className = 'bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 hover:border-blue-100';
            caseElement.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">${case_.title}</h3>
                    <span class="px-3 py-1 text-sm rounded-full font-medium ${this.getPriorityClass(case_.priority)}">
                        ${case_.priority}
                    </span>
                </div>
                <div class="prose prose-sm max-w-none text-gray-600 mb-4">
                    ${case_.description}
                </div>
                <div class="flex flex-wrap gap-2 mb-4">
                    <span class="px-3 py-1 text-sm rounded-full font-medium ${this.getStatusClass(case_.status)}">
                        ${case_.status}
                    </span>
                    ${case_.caseManager ? `
                    <span class="px-3 py-1 text-sm rounded-full font-medium bg-purple-100 text-purple-800">
                        <i class="fas fa-user-tie mr-1"></i>${case_.caseManager}
                    </span>
                    ` : ''}
                </div>
                <div class="flex justify-between items-center">
                    <div class="text-sm text-gray-500">
                        <i class="fas fa-clock mr-1"></i>
                        ${new Date(case_.updatedAt).toLocaleDateString()}
                    </div>
                    <button class="text-blue-600 hover:text-blue-800 font-medium flex items-center" onclick="ui.showCaseDetails('${case_.id}')">
                        View Details
                        <i class="fas fa-chevron-right ml-2 text-sm"></i>
                    </button>
                </div>
            `;
            casesGrid.appendChild(caseElement);
        });
    }

    showCaseDetails(caseId) {
        const case_ = this.caseManager.cases.find(c => c.id === caseId);
        this.currentCaseId = caseId; // Set the current case ID
        if (!case_) return;

        document.getElementById('detailTitle').textContent = case_.title;
        document.getElementById('caseDetails').innerHTML = `
                <div class="space-y-4">
                    <div>
                        <p class="text-gray-600">${case_.description}</p>
                    </div>
                    <div class="flex items-center space-x-4">
                        <span class="px-3 py-1 text-sm rounded-full font-medium ${this.getPriorityClass(case_.priority)}">
                            ${case_.priority}
                        </span>
                        <span class="px-3 py-1 text-sm rounded-full font-medium ${this.getStatusClass(case_.status)}">
                            ${case_.status}
                        </span>
                        ${case_.caseManager ? `
                        <span class="px-3 py-1 text-sm rounded-full font-medium bg-purple-100 text-purple-800">
                            <i class="fas fa-user-tie mr-1"></i>${case_.caseManager}
                        </span>
                        ` : ''}
                    </div>
                    <div class="border-t pt-4">
                        <h4 class="text-lg font-semibold mb-2">Attachments</h4>
                        <div id="attachmentsList" class="space-y-2">
                            ${this.renderAttachments(case_.id)}
                        </div>
                    </div>
                <div class="flex space-x-4">
                    <button onclick="ui.updateCaseStatus('${caseId}', 'open')" 
                            class="px-4 py-2 text-sm font-medium rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors duration-200">
                        <i class="fas fa-folder-open mr-2"></i>Open
                    </button>
                    <button onclick="ui.updateCaseStatus('${caseId}', 'in-progress')"
                            class="px-4 py-2 text-sm font-medium rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors duration-200">
                        <i class="fas fa-clock mr-2"></i>In Progress
                    </button>
                    <button onclick="ui.updateCaseStatus('${caseId}', 'closed')"
                            class="px-4 py-2 text-sm font-medium rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors duration-200">
                        <i class="fas fa-check-circle mr-2"></i>Close
                    </button>
                </div>
            </div>
        `;

        // Set up notes
        const notesContainer = document.getElementById('caseNotes');
        notesContainer.innerHTML = '';
        const notes = this.caseManager.notes[caseId] || [];
        notes.forEach(note => this.renderNote(note, caseId));

        // Set up new note form with enhanced styling
        const noteForm = document.getElementById('newNoteForm');
        noteForm.dataset.caseId = caseId;
        noteForm.className = 'mt-6';
        noteForm.innerHTML = `
            <div class="relative">
                <textarea id="newNote" placeholder="Add a note..." rows="2"
                        class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-24"></textarea>
                <button type="submit" class="absolute right-2 bottom-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center">
                    <i class="fas fa-plus mr-2"></i>
                    Add Note
                </button>
            </div>
        `;

        this.showModal('caseDetailModal');
    }

    renderAttachments(caseId) {
        const attachments = this.attachments[caseId] || [];
        if (attachments.length === 0) {
            return '<p class="text-gray-500 italic">No attachments yet</p>';
        }

        return attachments.map(attachment => {
            const fileIcon = this.getFileIcon(attachment.type);
            return `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                    <div class="flex items-center flex-1 min-w-0">
                        <i class="${fileIcon} text-blue-500 text-lg mr-3"></i>
                        <div class="flex-1 min-w-0">
                            <p class="font-medium text-gray-900 truncate">
                                ${attachment.name}
                            </p>
                            <p class="text-sm text-gray-500">
                                ${this.formatFileSize(attachment.size)} • 
                                ${new Date(attachment.uploadedAt).toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center ml-4">
                        <span class="text-sm text-gray-500 mr-4">
                            ${attachment.uploadedBy}
                        </span>
                        <button onclick="ui.downloadAttachment(${JSON.stringify(attachment)})" 
                                class="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    getFileIcon(mimeType) {
        if (!mimeType) return 'fas fa-file';
        
        if (mimeType.startsWith('image/')) return 'fas fa-file-image';
        if (mimeType.startsWith('video/')) return 'fas fa-file-video';
        if (mimeType.startsWith('audio/')) return 'fas fa-file-audio';
        if (mimeType.includes('pdf')) return 'fas fa-file-pdf';
        if (mimeType.includes('word') || mimeType.includes('document')) return 'fas fa-file-word';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fas fa-file-excel';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'fas fa-file-powerpoint';
        if (mimeType.includes('zip') || mimeType.includes('archive')) return 'fas fa-file-archive';
        if (mimeType.includes('text/')) return 'fas fa-file-alt';
        
        return 'fas fa-file';
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
    }

    renderNote(note, caseId) {
        const notesContainer = document.getElementById('caseNotes');
        const noteElement = document.createElement('div');
        noteElement.className = 'bg-white p-4 rounded-lg shadow-sm border border-gray-100';
        noteElement.innerHTML = `
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                    <i class="fas fa-comment-alt text-blue-500"></i>
                </div>
                <div class="flex-1">
                    <div class="prose prose-sm max-w-none text-gray-700 mb-2">
                        ${note.content}
                    </div>
                    <div class="flex items-center justify-between text-sm text-gray-500">
                        <div class="flex items-center">
                            <i class="fas fa-user mr-1"></i>
                            ${note.createdBy}
                        </div>
                        <div class="flex items-center">
                            <i class="fas fa-clock mr-1"></i>
                            ${new Date(note.createdAt).toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>
        `;
        notesContainer.appendChild(noteElement);
    }

    updateCaseStatus(caseId, status) {
        const updatedCase = this.caseManager.updateCase(caseId, { status });
        if (updatedCase) {
            this.renderCases();
            this.showCaseDetails(caseId);
        }
    }
}

// Initialize the application
const caseManager = new CaseManager();
const ui = new UI(caseManager);
