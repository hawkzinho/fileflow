// FileFlow Frontend - Sistema Completo Corrigido
class FileFlowApp {
    constructor() {
        this.currentUser = null;
        this.ws = null;
        this.currentRoom = null;
        this.typingTimer = null;
        this.isTyping = false;
        
        this.initializeApp();
    }

    initializeApp() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.hideLoadingScreen();
    }

    hideLoadingScreen() {
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
        }, 1000);
    }

    setupEventListeners() {
        // Auth Events
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });

        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });

        document.getElementById('loginFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        document.getElementById('registerFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.register();
        });

        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.showSection(btn.dataset.section);
            });
        });

        document.querySelectorAll('.dropdown-menu a[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSection(link.dataset.section);
            });
        });

        // File Events - REMOVIDO UPLOAD FORA DE SALAS
        document.getElementById('uploadBtn')?.addEventListener('click', () => {
            this.showNotification('Selecione uma sala para compartilhar arquivos', 'info');
        });

        document.getElementById('uploadArea')?.addEventListener('click', () => {
            this.showNotification('Entre em uma sala para compartilhar arquivos', 'info');
        });

        // Room Events
        document.getElementById('createRoomBtn').addEventListener('click', () => {
            this.showModal('createRoomModal');
        });

        document.getElementById('createRoomForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createRoom();
        });

        // Friend Events
        document.getElementById('addFriendBtn').addEventListener('click', () => {
            this.showModal('addFriendModal');
        });

        document.getElementById('addFriendForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendFriendRequest();
        });

        // Tab Events
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        // Search Events
        document.getElementById('userSearch').addEventListener('input', (e) => {
            this.searchUsers(e.target.value);
        });

        // Profile Events
        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProfile();
        });

        // Chat Events
        document.getElementById('closeChat').addEventListener('click', () => {
            this.closeChat();
        });

        document.getElementById('sendMessage').addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        document.getElementById('chatInput').addEventListener('input', () => {
            this.handleTyping();
        });

        // Modal Events
        document.querySelectorAll('.modal-close, .btn-secondary[data-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal(btn.dataset.modal || btn.closest('.modal').id);
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Room Invite Form
        document.getElementById('roomInviteForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendRoomInvite();
        });
    }

    // Authentication Methods
    async login() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await this.apiCall('/api/auth/login', 'POST', {
                email,
                password
            });

            if (response.success) {
                this.currentUser = response.user;
                this.showMainApp();
                this.showNotification('Login realizado com sucesso!', 'success');
                this.initializeWebSocket();
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async register() {
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;

        try {
            const response = await this.apiCall('/api/auth/register', 'POST', {
                name,
                email,
                password
            });

            if (response.success) {
                this.showNotification('Cadastro realizado com sucesso!', 'success');
                this.showLoginForm();
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async logout() {
        try {
            await this.apiCall('/api/auth/logout', 'POST');
            this.currentUser = null;
            this.ws?.close();
            this.showAuthScreen();
            this.showNotification('Logout realizado com sucesso!', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    checkAuthStatus() {
        if (this.currentUser) {
            this.showMainApp();
        } else {
            this.showAuthScreen();
        }
    }

    // Navigation Methods
    showAuthScreen() {
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        this.showLoginForm();
    }

    showMainApp() {
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        this.loadUserData();
        this.loadInitialData();
    }

    showLoginForm() {
        document.getElementById('loginForm').classList.add('active');
        document.getElementById('registerForm').classList.remove('active');
    }

    showRegisterForm() {
        document.getElementById('loginForm').classList.remove('active');
        document.getElementById('registerForm').classList.add('active');
    }

    showSection(sectionName) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}Section`).classList.add('active');

        switch(sectionName) {
            case 'files':
                this.loadUserFiles();
                break;
            case 'rooms':
                this.loadUserRooms();
                break;
            case 'friends':
                this.loadFriends();
                break;
            case 'profile':
                this.loadProfile();
                break;
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');

        if (tabName === 'friends') {
            this.loadFriends();
        } else if (tabName === 'requests') {
            this.loadFriendRequests();
        }
    }

    // File Management Methods - MODIFICADO: Só em salas
    async loadUserFiles() {
        try {
            const response = await this.apiCall('/api/files');
            
            const filesGrid = document.getElementById('filesGrid');
            const emptyState = document.getElementById('emptyState');

            if (response.files.length === 0) {
                filesGrid.innerHTML = '';
                emptyState.style.display = 'block';
                return;
            }

            emptyState.style.display = 'none';
            filesGrid.innerHTML = response.files.map(file => `
                <div class="file-card">
                    <div class="file-icon">
                        ${this.getFileIcon(file.mimetype)}
                    </div>
                    <div class="file-info">
                        <h3>${file.original_name}</h3>
                        <div class="file-meta">
                            <span>${this.formatFileSize(file.size)}</span>
                            <span>Sala: ${file.room_id || 'Geral'}</span>
                        </div>
                        <div class="file-actions">
                            <button class="btn btn-primary btn-small" onclick="app.downloadFile(${file.id})">
                                <i class="fas fa-download"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            this.showNotification('Erro ao carregar arquivos', 'error');
        }
    }

    async downloadFile(fileId) {
        try {
            window.open(`/api/files/${fileId}/download`, '_blank');
            this.showNotification('Download iniciado', 'success');
        } catch (error) {
            this.showNotification('Erro ao fazer download', 'error');
        }
    }

    // Room Management Methods
    async createRoom() {
        const name = document.getElementById('roomName').value;
        const description = document.getElementById('roomDescription').value;

        try {
            const response = await this.apiCall('/api/rooms', 'POST', {
                name,
                description
            });

            if (response.success) {
                this.showNotification('Sala criada com sucesso!', 'success');
                this.closeModal('createRoomModal');
                this.loadUserRooms();
                document.getElementById('createRoomForm').reset();
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async loadUserRooms() {
        try {
            const response = await this.apiCall('/api/rooms');
            
            const roomsGrid = document.getElementById('roomsGrid');
            const emptyState = document.getElementById('roomsEmptyState');

            if (response.rooms.length === 0) {
                roomsGrid.innerHTML = '';
                emptyState.style.display = 'block';
                return;
            }

            emptyState.style.display = 'none';
            roomsGrid.innerHTML = response.rooms.map(room => `
                <div class="room-card ${room.is_active ? 'active' : ''}">
                    <div class="room-header">
                        <div class="room-name">${room.name}</div>
                        <div class="room-status ${room.is_active ? '' : 'offline'}">
                            ${room.is_active ? 'Online' : 'Offline'}
                        </div>
                    </div>
                    <p class="room-description">${room.description || 'Sem descrição'}</p>
                    <div class="room-members">
                        <div class="member-avatar">${this.currentUser.avatar}</div>
                        <span class="member-count">+${room.member_count - 1} membros</span>
                    </div>
                    <div class="room-actions">
                        <button class="btn btn-primary" onclick="app.enterRoom(${room.id})">
                            <i class="fas fa-door-open"></i>
                            Entrar
                        </button>
                        <button class="btn btn-outline" onclick="app.inviteToRoom(${room.id})">
                            <i class="fas fa-user-plus"></i>
                            Convidar
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            this.showNotification('Erro ao carregar salas', 'error');
        }
    }

    async enterRoom(roomId) {
        try {
            const messagesResponse = await this.apiCall(`/api/rooms/${roomId}/messages`);
            
            this.currentRoom = roomId;
            this.openChat(roomId, messagesResponse.messages);
            
            if (this.ws) {
                this.ws.send(JSON.stringify({
                    type: 'join_room',
                    roomId: roomId,
                    userId: this.currentUser.id
                }));
            }
        } catch (error) {
            this.showNotification('Erro ao entrar na sala', 'error');
        }
    }

    inviteToRoom(roomId) {
        document.getElementById('inviteRoomId').value = roomId;
        this.showModal('roomInviteModal');
    }

    async sendRoomInvite() {
        const roomId = document.getElementById('inviteRoomId').value;
        const email = document.getElementById('inviteEmail').value;

        try {
            await this.apiCall(`/api/rooms/${roomId}/invite`, 'POST', { email });
            this.showNotification('Convite enviado com sucesso!', 'success');
            this.closeModal('roomInviteModal');
            document.getElementById('roomInviteForm').reset();
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    // Friend Management Methods - CORRIGIDAS
    async sendFriendRequest() {
        const email = document.getElementById('friendEmail').value;

        try {
            const response = await this.apiCall('/api/friends/request', 'POST', { email });
            
            if (response.success) {
                this.showNotification('Solicitação de amizade enviada!', 'success');
                this.closeModal('addFriendModal');
                document.getElementById('addFriendForm').reset();
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async loadFriends() {
        try {
            const response = await this.apiCall('/api/friends');
            
            const friendsList = document.getElementById('friendsList');
            friendsList.innerHTML = response.friends.map(friend => `
                <div class="friend-item">
                    <div class="friend-avatar">${friend.avatar}</div>
                    <div class="friend-info">
                        <h4>${friend.name}</h4>
                        <p>${friend.online ? 'Online' : 'Último visto: ' + new Date().toLocaleTimeString()}</p>
                    </div>
                    <div class="friend-status ${friend.online ? '' : 'offline'}"></div>
                    <div class="friend-actions">
                        <button class="btn btn-danger btn-small" onclick="app.removeFriend(${friend.friendship_id})">
                            <i class="fas fa-user-times"></i>
                        </button>
                    </div>
                </div>
            `).join('');

            this.updateOnlineFriends(response.friends);
        } catch (error) {
            this.showNotification('Erro ao carregar amigos', 'error');
        }
    }

    async loadFriendRequests() {
        try {
            const response = await this.apiCall('/api/friends/requests/pending');
            
            const requestsList = document.getElementById('requestsList');
            if (response.requests.length === 0) {
                requestsList.innerHTML = '<p class="text-center">Nenhuma solicitação pendente</p>';
                return;
            }

            requestsList.innerHTML = response.requests.map(request => `
                <div class="request-item">
                    <div class="request-avatar">${request.avatar}</div>
                    <div class="request-info">
                        <h4>${request.name}</h4>
                        <p>${request.email}</p>
                    </div>
                    <div class="request-actions">
                        <button class="btn btn-success btn-small" onclick="app.acceptFriendRequest(${request.friendship_id})">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-danger btn-small">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Erro ao carregar solicitações:', error);
        }
    }

    async acceptFriendRequest(friendshipId) {
        try {
            await this.apiCall(`/api/friends/request/${friendshipId}/accept`, 'POST');
            this.showNotification('Solicitação aceita!', 'success');
            this.loadFriendRequests();
            this.loadFriends();
        } catch (error) {
            this.showNotification('Erro ao aceitar solicitação', 'error');
        }
    }

    async removeFriend(friendshipId) {
        if (!confirm('Tem certeza que deseja remover este amigo?')) return;

        try {
            await this.apiCall(`/api/friends/${friendshipId}`, 'DELETE');
            this.showNotification('Amigo removido com sucesso!', 'success');
            this.loadFriends();
        } catch (error) {
            this.showNotification('Erro ao remover amigo', 'error');
        }
    }

    async searchUsers(query) {
        if (query.length < 2) {
            document.getElementById('searchResults').innerHTML = '';
            return;
        }

        try {
            const response = await this.apiCall(`/api/friends/search?query=${encodeURIComponent(query)}`);
            
            const searchResults = document.getElementById('searchResults');
            searchResults.innerHTML = response.users.map(user => `
                <div class="friend-item">
                    <div class="friend-avatar">${user.avatar}</div>
                    <div class="friend-info">
                        <h4>${user.name}</h4>
                        <p>${user.email}</p>
                    </div>
                    <div class="friend-status ${user.online ? '' : 'offline'}"></div>
                    <div class="friend-actions">
                        <button class="btn btn-primary btn-small" onclick="app.sendFriendRequestTo('${user.email}')">
                            <i class="fas fa-user-plus"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            // Ignore search errors
        }
    }

    sendFriendRequestTo(email) {
        document.getElementById('friendEmail').value = email;
        this.showModal('addFriendModal');
    }

    updateOnlineFriends(friends) {
        const onlineFriends = friends.filter(friend => friend.online);
        const onlineList = document.getElementById('onlineFriends');
        const onlineCount = document.getElementById('onlineCount');

        onlineCount.textContent = onlineFriends.length;
        
        if (onlineFriends.length === 0) {
            onlineList.innerHTML = '<p class="text-center">Nenhum amigo online</p>';
            return;
        }

        onlineList.innerHTML = onlineFriends.map(friend => `
            <div class="online-item">
                <div class="online-avatar">${friend.avatar}</div>
                <div class="online-name">${friend.name}</div>
                <div class="online-status"></div>
            </div>
        `).join('');
    }

    // Profile Methods
    async loadProfile() {
        try {
            const response = await this.apiCall('/api/auth/profile');
            
            if (response.success) {
                const user = response.user;
                document.getElementById('profileName').textContent = user.name;
                document.getElementById('profileEmail').textContent = user.email;
                document.getElementById('profileEmailInput').value = user.email;
                document.getElementById('displayName').value = user.name;
                document.getElementById('profileAvatar').textContent = user.avatar;

                // Load stats
                const filesResponse = await this.apiCall('/api/files');
                const friendsResponse = await this.apiCall('/api/friends');
                const roomsResponse = await this.apiCall('/api/rooms');

                document.getElementById('filesCount').textContent = filesResponse.files.length;
                document.getElementById('friendsCount').textContent = friendsResponse.friends.length;
                document.getElementById('roomsCount').textContent = roomsResponse.rooms.length;
            }
        } catch (error) {
            this.showNotification('Erro ao carregar perfil', 'error');
        }
    }

    async updateProfile() {
        const name = document.getElementById('displayName').value;

        try {
            await this.apiCall('/api/auth/profile', 'PUT', { name });
            this.showNotification('Perfil atualizado com sucesso!', 'success');
            this.currentUser.name = name;
            this.loadUserData();
        } catch (error) {
            this.showNotification('Erro ao atualizar perfil', 'error');
        }
    }

    // Chat Methods
    openChat(roomId, messages) {
        const chatContainer = document.getElementById('chatContainer');
        const chatMessages = document.getElementById('chatMessages');
        
        // Find room name
        const roomElement = document.querySelector(`[data-room="${roomId}"]`);
        const roomName = roomElement ? roomElement.textContent : 'Sala ' + roomId;
        
        document.getElementById('chatRoomName').textContent = roomName;
        
        // Load messages
        chatMessages.innerHTML = messages.map(message => `
            <div class="message ${message.user_id === this.currentUser.id ? 'own' : 'other'}">
                <div class="message-sender">${message.user_name}</div>
                <div class="message-content">${message.content}</div>
                <div class="message-time">${new Date(message.created_at).toLocaleTimeString()}</div>
            </div>
        `).join('');

        chatContainer.classList.add('open');
        this.scrollChatToBottom();
    }

    closeChat() {
        document.getElementById('chatContainer').classList.remove('open');
        this.currentRoom = null;
    }

    async sendMessage() {
        const input = document.getElementById('chatInput');
        const content = input.value.trim();

        if (!content || !this.currentRoom) return;

        try {
            const response = await this.apiCall(`/api/rooms/${this.currentRoom}/messages`, 'POST', { content });
            
            if (response.success) {
                this.addMessageToChat(response.message);
                input.value = '';
                this.isTyping = false;
            }
        } catch (error) {
            this.showNotification('Erro ao enviar mensagem', 'error');
        }
    }

    handleTyping() {
        if (!this.isTyping) {
            this.isTyping = true;
        }

        clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => {
            this.isTyping = false;
        }, 1000);
    }

    addMessageToChat(message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        
        messageElement.className = `message ${message.user_id === this.currentUser.id ? 'own' : 'other'}`;
        messageElement.innerHTML = `
            <div class="message-sender">${message.user_name}</div>
            <div class="message-content">${message.content}</div>
            <div class="message-time">${new Date(message.created_at).toLocaleTimeString()}</div>
        `;

        chatMessages.appendChild(messageElement);
        this.scrollChatToBottom();
    }

    scrollChatToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Utility Methods
    async apiCall(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include'
        };

        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(endpoint, options);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Erro na requisição');
        }

        return result;
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        const notification = document.createElement('div');
        
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-header">
                <div class="notification-title">
                    ${type === 'success' ? 'Sucesso' : type === 'error' ? 'Erro' : 'Info'}
                </div>
                <button class="notification-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="notification-message">${message}</div>
        `;

        notifications.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);

        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }

    loadUserData() {
        if (!this.currentUser) return;

        document.getElementById('userName').textContent = this.currentUser.name;
        document.getElementById('userAvatar').textContent = this.currentUser.avatar;
    }

    loadInitialData() {
        this.loadUserFiles();
        this.loadUserRooms();
        this.loadFriends();
        this.loadFriendRequests();
    }

    getFileIcon(mimetype) {
        if (mimetype.includes('image')) return '<i class="fas fa-file-image"></i>';
        if (mimetype.includes('video')) return '<i class="fas fa-file-video"></i>';
        if (mimetype.includes('audio')) return '<i class="fas fa-file-audio"></i>';
        if (mimetype.includes('pdf')) return '<i class="fas fa-file-pdf"></i>';
        if (mimetype.includes('zip') || mimetype.includes('compressed')) return '<i class="fas fa-file-archive"></i>';
        if (mimetype.includes('text') || mimetype.includes('document')) return '<i class="fas fa-file-alt"></i>';
        return '<i class="fas fa-file"></i>';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // WebSocket simplificado
    initializeWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket conectado');
            this.ws.send(JSON.stringify({
                type: 'authenticate',
                userId: this.currentUser.id
            }));
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'new_message' && message.message.room_id === this.currentRoom) {
                this.addMessageToChat(message.message);
            }
        };
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FileFlowApp();
});