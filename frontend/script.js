class FileFlow {
    constructor() {
        this.socket = null;
        this.currentRoom = null;
        this.username = null;
        this.initializeApp();
    }

    initializeApp() {
        // Elementos DOM
        this.joinPanel = document.getElementById('joinPanel');
        this.app = document.getElementById('app');
        this.usernameInput = document.getElementById('usernameInput');
        this.roomInput = document.getElementById('roomInput');
        this.joinBtn = document.getElementById('joinBtn');
        this.createRoomBtn = document.getElementById('createRoomBtn');
        this.roomLink = document.getElementById('roomLink');
        this.inviteLink = document.getElementById('inviteLink');
        this.copyLinkBtn = document.getElementById('copyLinkBtn');
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendMessageBtn = document.getElementById('sendMessageBtn');
        this.usersList = document.getElementById('usersList');
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.fileList = document.getElementById('fileList');
        this.currentRoomSpan = document.getElementById('currentRoom');
        this.userCount = document.getElementById('userCount');

        // Event listeners
        this.joinBtn.addEventListener('click', () => this.joinRoom());
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.copyLinkBtn.addEventListener('click', () => this.copyInviteLink());
        this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Upload de arquivos
        this.setupFileUpload();

        // Verificar se há sala na URL
        this.checkUrlForRoom();
    }

    checkUrlForRoom() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomFromUrl = urlParams.get('room');
        if (roomFromUrl) {
            this.roomInput.value = roomFromUrl;
        }
    }

    generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    createRoom() {
        const username = this.usernameInput.value.trim();
        if (!username) {
            alert('Digite seu nome!');
            return;
        }

        const roomId = this.generateRoomId();
        this.roomInput.value = roomId;
        this.showInviteLink(roomId);
    }

    showInviteLink(roomId) {
        const link = `${window.location.origin}?room=${roomId}`;
        this.inviteLink.value = link;
        this.roomLink.classList.remove('hidden');
    }

    copyInviteLink() {
        this.inviteLink.select();
        document.execCommand('copy');
        alert('✅ Link copiado! Compartilhe com seus amigos.');
    }

    async joinRoom() {
        this.username = this.usernameInput.value.trim();
        this.currentRoom = this.roomInput.value.trim().toUpperCase();

        if (!this.username || !this.currentRoom) {
            alert('Preencha nome e sala!');
            return;
        }

        // ⚠️ VERIFICAÇÃO DO SOCKET.IO
        if (typeof io === 'undefined') {
            alert('❌ Socket.io não carregou! Recarregue a página.');
            return;
        }

        try {
            // Conectar ao servidor Socket.io
            this.socket = io();

            this.socket.emit('join-room', this.currentRoom, this.username);

            // Configurar listeners do socket
            this.setupSocketListeners();

            // Mostrar aplicação principal
            this.joinPanel.classList.add('hidden');
            this.app.classList.remove('hidden');
            this.currentRoomSpan.textContent = this.currentRoom;

            this.addSystemMessage(`🎉 Você entrou na sala "${this.currentRoom}"`);

        } catch (error) {
            console.error('Erro ao conectar:', error);
            alert('Erro ao conectar com o servidor');
        }
    }

    setupSocketListeners() {
        this.socket.on('user-joined', (username) => {
            this.addSystemMessage(`👋 ${username} entrou na sala`);
        });

        this.socket.on('user-left', (username) => {
            this.addSystemMessage(`👋 ${username} saiu da sala`);
        });

        this.socket.on('users-update', (users) => {
            this.updateUsersList(users);
        });

        this.socket.on('new-message', (data) => {
            this.addMessage(data.username, data.message, data.timestamp, data.username === this.username);
        });

        this.socket.on('new-file', (fileData) => {
            this.addFileMessage(fileData);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Erro de conexão:', error);
            alert('❌ Erro ao conectar com o servidor. Verifique se o backend está rodando.');
        });
    }

    setupFileUpload() {
        this.uploadArea.addEventListener('click', () => {
            this.fileInput.click();
        });

        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
    }

    async handleFiles(files) {
        for (let file of files) {
            await this.uploadFile(file);
        }
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Mostrar progresso
            const fileItem = this.createFileItem(file);
            this.fileList.prepend(fileItem);

            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const fileData = await response.json();

            // Compartilhar arquivo na sala
            this.socket.emit('share-file', {
                roomId: this.currentRoom,
                username: this.username,
                file: fileData,
                timestamp: new Date()
            });

            // Atualizar interface
            fileItem.querySelector('.file-status').textContent = '✅ Enviado';
            fileItem.classList.add('uploaded');

            console.log('✅ Arquivo enviado com sucesso:', file.name);

        } catch (error) {
            console.error('❌ Erro no upload:', error);
            alert(`❌ Erro ao enviar arquivo "${file.name}": ${error.message}`);
        }
    }

    createFileItem(file) {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `
            <div class="file-info">
                <span class="file-icon">📄</span>
                <div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${this.formatFileSize(file.size)}</div>
                </div>
            </div>
            <div class="file-status">⏳ Enviando...</div>
        `;
        return div;
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        this.socket.emit('send-message', {
            roomId: this.currentRoom,
            username: this.username,
            message: message
        });

    
        this.messageInput.value = '';
    }

    addMessage(username, message, timestamp, isOwn = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'own-message' : 'other-message'}`;
        
        const time = new Date(timestamp).toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <strong>${username}</strong>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message)}</div>
        `;

        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    addFileMessage(fileData) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message file-message';
        
        const time = new Date(fileData.timestamp).toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <strong>${fileData.username}</strong>
                <span class="message-time">${time}</span>
            </div>
            <div class="file-preview">
                <span class="file-icon">📄</span>
                <div class="file-info">
                    <div class="file-name">${fileData.file.originalName}</div>
                    <div class="file-size">${this.formatFileSize(fileData.file.size)}</div>
                </div>
                <a href="${fileData.file.downloadUrl}" class="download-btn" download="${fileData.file.originalName}">📥 Baixar</a>
            </div>
        `;

        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    addSystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';
        messageDiv.textContent = message;
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    updateUsersList(users) {
        this.usersList.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            li.textContent = user;
            this.usersList.appendChild(li);
        });
        this.userCount.textContent = `Usuários: ${users.length}`;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Inicializar aplicação quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.fileFlowApp = new FileFlow();
});