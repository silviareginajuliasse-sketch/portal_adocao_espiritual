(function() {
    function updateUserName() {
        const urlParams = new URLSearchParams(window.location.search);
        let nome = urlParams.get('nome');
        let id_colab = urlParams.get('id_colaborador') || urlParams.get('cpf');

        // If found in URL, save to localStorage
        if (nome) {
            localStorage.setItem('user_nome', nome);
        } else {
            nome = localStorage.getItem('user_nome') || '';
        }

        if (id_colab) {
            localStorage.setItem('user_id_colaborador', id_colab);
        } else {
            id_colab = localStorage.getItem('user_id_colaborador') || '2';
        }

        // Header Update
        const userDisplay = document.getElementById('user-display');
        const userId = document.getElementById('user-id');
        if (userDisplay) userDisplay.innerText = nome;
        if (userId) userId.innerText = id_colab;

        // Dropdown Update
        const dropdownName = document.getElementById('dropdown-full-name');
        const dropdownId = document.getElementById('dropdown-id');
        if (dropdownName) dropdownName.innerText = nome;
        if (dropdownId) dropdownId.innerText = id_colab;

        // Profile Display Update
        const userRoles = document.querySelectorAll('.user-role strong');
        const userNomePerfil = localStorage.getItem('user_nome_perfil');
        if (userNomePerfil && userRoles.length > 0) {
            userRoles.forEach(el => {
                el.innerText = userNomePerfil;
            });
        }
        // Update "Minha Conta" -> "Atualizar cadastro" link dynamically using localStorage
        const savedId = localStorage.getItem('user_id_colaborador') || id_colab;
        const updateLinks = document.querySelectorAll('.update-link');
        updateLinks.forEach(link => {
            link.href = `registro_colaboradores.html?id=${savedId}&from=minha_conta`;
        });

        // Generate Initials or Load Photo
        const userInitials = document.getElementById('user-initials');
        if (userInitials) {
            const savedPhoto = localStorage.getItem('adocao_user_photo');
            if (savedPhoto) {
                userInitials.innerHTML = `<img src="${savedPhoto}" style="width: 100%; height: 100%; object-fit: cover;" alt="User">`;
                const avatarContent = document.getElementById('avatar-content');
                if (avatarContent) avatarContent.innerHTML = `<img src="${savedPhoto}" class="user-photo" alt="Profile">`;
            } else {
                const initials = nome.split(' ')
                    .filter(n => n.length > 0)
                    .map(n => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();
                userInitials.innerHTML = `<span style="font-weight: 700; color: #557db5;">${initials || '??'}</span>`;
                const avatarContent = document.getElementById('avatar-content');
                if (avatarContent) avatarContent.innerHTML = `<i class="fa-solid fa-user"></i>`;
                
                // Fetch dynamically from DB since it is not in localStorage
                if (id_colab) {
                    const apiUrl = window.location.protocol === 'file:' 
                        ? `http://${window.location.hostname || 'localhost'}:3000/api/colaboradores/${id_colab}`
                        : `/api/colaboradores/${id_colab}`;
                    
                    fetch(apiUrl)
                        .then(res => res.ok ? res.json() : null)
                        .then(colab => {
                            if (colab && colab.foto_colaborador) {
                                localStorage.setItem('adocao_user_photo', colab.foto_colaborador);
                                userInitials.innerHTML = `<img src="${colab.foto_colaborador}" style="width: 100%; height: 100%; object-fit: cover;" alt="User">`;
                                const avatarContentInner = document.getElementById('avatar-content');
                                if (avatarContentInner) avatarContentInner.innerHTML = `<img src="${colab.foto_colaborador}" class="user-photo" alt="Profile">`;
                            }
                        })
                        .catch(err => console.warn('Could not fetch user photo:', err));
                }
            }
        }
    }

    function handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const base64Image = e.target.result;
                localStorage.setItem('adocao_user_photo', base64Image);
                updateUserName(); // Refresh header with the new photo
            };
            reader.readAsDataURL(file);
        }
    }

    async function loadDynamicMenu() {
        const sidebarList = document.querySelector('#sidebar .sidebar-list');
        if (!sidebarList) return;

        try {
            // Determine API URL dynamically (use relative path if served via http/https, fallback to localhost:3000 on file://)
            const apiUrl = window.location.protocol === 'file:' 
                ? `http://${window.location.hostname || 'localhost'}:3000/api/menu`
                : '/api/menu';

            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('Failed to fetch menu');
            const menuItems = await response.json();

            if (menuItems && menuItems.length > 0) {
                // Apply grid class
                sidebarList.classList.add('grid-menu');

                // Inject grid styles if not present
                if (!document.getElementById('grid-menu-styles')) {
                    const style = document.createElement('style');
                    style.id = 'grid-menu-styles';
                    style.textContent = `
                        .sidebar {
                            width: 480px !important;
                            right: -480px !important;
                        }
                        .sidebar.active {
                            right: 0 !important;
                        }
                        @media (max-width: 480px) {
                            .sidebar {
                                width: 100vw !important;
                                right: -100vw !important;
                            }
                            .sidebar-list.grid-menu {
                                grid-template-columns: 1fr !important;
                                gap: 12px !important;
                            }
                        }
                        .sidebar-list.grid-menu {
                            display: grid !important;
                            grid-template-columns: 1fr 1fr !important;
                            gap: 16px 24px !important;
                            padding: 24px 20px !important;
                            list-style: none !important;
                            align-content: start !important;
                        }
                        .sidebar-list.grid-menu li {
                            list-style: none !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                        .sidebar-list.grid-menu .sidebar-item {
                            display: flex !important;
                            flex-direction: row !important;
                            align-items: center !important;
                            justify-content: flex-start !important;
                            text-align: left !important;
                            padding: 6px 4px !important;
                            background: transparent !important;
                            border: none !important;
                            border-radius: 0 !important;
                            color: #4a5568 !important;
                            text-decoration: none !important;
                            font-size: 0.85rem !important;
                            font-weight: 500 !important;
                            height: auto !important;
                            min-height: 40px !important;
                            transition: color 0.2s ease !important;
                            box-sizing: border-box !important;
                            line-height: 1.3 !important;
                        }
                        .sidebar-list.grid-menu .sidebar-item:hover {
                            background: transparent !important;
                            color: #8b1e1e !important;
                        }
                        .sidebar-list.grid-menu .sidebar-item img {
                            width: 24px !important;
                            height: 24px !important;
                            margin-right: 12px !important;
                            margin-bottom: 0 !important;
                            object-fit: contain !important;
                            filter: grayscale(100%) opacity(0.8) !important;
                            transition: filter 0.2s ease, opacity 0.2s ease !important;
                        }
                        .sidebar-list.grid-menu .sidebar-item:hover img {
                            filter: none !important;
                            opacity: 1 !important;
                        }
                    `;
                    document.head.appendChild(style);
                }

                // Retrieve user details from localStorage
                const nome = localStorage.getItem('user_nome') || '';
                const id_colab = localStorage.getItem('user_id_colaborador') || '2';
                const userParams = `&nome=${encodeURIComponent(nome)}&id_colaborador=${encodeURIComponent(id_colab)}&cpf=${encodeURIComponent(id_colab)}`;

                // Render menu items
                sidebarList.innerHTML = menuItems.map(item => {
                    let href = item.pagina;
                    if (href && href !== '#') {
                        href += href.includes('?') ? userParams : `?${userParams.substring(1)}`;
                    } else {
                        href = '#';
                    }
                    return `
                        <li>
                            <a href="${href}" class="sidebar-item">
                                ${item.icone ? `<img src="${item.icone}" alt="${item.nome_menu}" onerror="this.style.display='none'" />` : ''}
                                <span>${item.nome_menu}</span>
                            </a>
                        </li>
                    `;
                }).join('');
            }
        } catch (err) {
            console.warn('Could not load dynamic menu, keeping fallback:', err);
        }
    }

    // Attach to global window object
    window.updateUserName = updateUserName;
    window.handlePhotoUpload = handlePhotoUpload;

    // Run automatically when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            updateUserName();
            loadDynamicMenu();
            const input = document.getElementById('hidden-photo-input');
            if (input) {
                input.addEventListener('change', handlePhotoUpload);
            }
        });
    } else {
        updateUserName();
        loadDynamicMenu();
        const input = document.getElementById('hidden-photo-input');
        if (input) {
            input.addEventListener('change', handlePhotoUpload);
        }
    }
})();
