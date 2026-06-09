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

    async function checkSurveyStatus() {
        // Don't show the reminder if the user is on the survey form itself
        if (window.location.pathname.includes('pesquisa_satisfacao.html')) return;

        const id_colab = localStorage.getItem('user_id_colaborador');
        if (!id_colab || id_colab === 'null' || id_colab === 'undefined' || id_colab === '') return;

        const respondedLocal = localStorage.getItem('adocao_survey_responded_' + id_colab) === 'true';
        if (respondedLocal) return;

        try {
            const apiUrl = window.location.protocol === 'file:' 
                ? `http://${window.location.hostname || 'localhost'}:3000/api/pesquisa_satisfacao/status/${id_colab}`
                : `/api/pesquisa_satisfacao/status/${id_colab}`;
            
            const res = await fetch(apiUrl);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.responded) {
                    localStorage.setItem('adocao_survey_responded_' + id_colab, 'true');
                    return; // Already responded, do nothing
                }
            }
        } catch (err) {
            console.warn('Could not check survey response status:', err);
        }

        // User hasn't responded yet, show visual notification
        showSurveyNotificationPill();
    }

    function showSurveyNotificationPill() {
        const headerRight = document.querySelector('.header-right');
        if (!headerRight) return;

        // If the pill is already present, don't duplicate it
        if (document.getElementById('survey-notification-pill')) return;

        // Dynamic styles
        if (!document.getElementById('survey-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'survey-notification-styles';
            style.textContent = `
                .survey-notification-pill {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background-color: #fff8e1;
                    border: 1px solid #ffe082;
                    color: #b78103;
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 700;
                    text-decoration: none;
                    transition: all 0.2s ease;
                    margin-right: 15px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                }
                .survey-notification-pill:hover {
                    background-color: #fff3cd;
                    border-color: #ffe082;
                    color: #996500;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.08);
                }
                .survey-notification-pill i {
                    font-size: 14px;
                    color: #d48e00;
                }
                .survey-notification-pill .pulse-dot {
                    width: 8px;
                    height: 8px;
                    background-color: #e53e3e;
                    border-radius: 50%;
                    display: inline-block;
                    box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.7);
                    animation: survey-pulse-animation 1.5s infinite;
                }
                @keyframes survey-pulse-animation {
                    0% {
                        transform: scale(0.95);
                        box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.7);
                    }
                    70% {
                        transform: scale(1);
                        box-shadow: 0 0 0 6px rgba(229, 62, 62, 0);
                    }
                    100% {
                        transform: scale(0.95);
                        box-shadow: 0 0 0 0 rgba(229, 62, 62, 0);
                    }
                }
                @media (max-width: 576px) {
                    .survey-notification-pill span:not(.pulse-dot) {
                        display: none;
                    }
                    .survey-notification-pill {
                        padding: 6px;
                        margin-right: 8px;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        const nome = localStorage.getItem('user_nome') || '';
        const id_colab = localStorage.getItem('user_id_colaborador') || '2';

        const pill = document.createElement('a');
        pill.id = 'survey-notification-pill';
        pill.className = 'survey-notification-pill';
        pill.href = '#';
        pill.onclick = (e) => {
            e.preventDefault();
            openSurveyModal();
        };
        pill.innerHTML = `
            <span class="pulse-dot"></span>
            <i class="fa-solid fa-square-poll-vertical"></i>
            <span>Pesquisa de Satisfação</span>
        `;

        // Prepend inside header-right (comes before hamburger/profile)
        headerRight.insertBefore(pill, headerRight.firstChild);
    }

    async function openSurveyModal() {
        // If modal already open, do nothing
        if (document.getElementById('survey-modal-overlay')) return;

        // Create modal overlay container
        const overlay = document.createElement('div');
        overlay.id = 'survey-modal-overlay';
        overlay.className = 'survey-modal-overlay';

        // Add modal styles dynamically if not present
        if (!document.getElementById('survey-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'survey-modal-styles';
            style.textContent = `
                .survey-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background-color: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                    -webkit-backdrop-filter: blur(4px);
                    z-index: 9999;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    opacity: 0;
                    transition: opacity 0.25s ease;
                }
                .survey-modal-overlay.active {
                    opacity: 1;
                }
                .survey-modal-box {
                    background-color: white;
                    border-radius: 16px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                    width: 90%;
                    max-width: 650px;
                    max-height: 85vh;
                    overflow-y: auto;
                    position: relative;
                    padding: 30px;
                    transform: translateY(20px);
                    transition: transform 0.25s ease;
                    border: 1px solid #edf2f7;
                    box-sizing: border-box;
                }
                .survey-modal-overlay.active .survey-modal-box {
                    transform: translateY(0);
                }
                .survey-modal-close-btn {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    font-size: 16px;
                    cursor: pointer;
                    color: #a0aec0;
                    background: #edf2f7;
                    border: none;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    z-index: 10000;
                }
                .survey-modal-close-btn:hover {
                    background-color: #e2e8f0;
                    color: #2d3748;
                    transform: scale(1.05);
                }
                
                /* Title Styles */
                .survey-title {
                    color: #7b0000 !important;
                    font-size: 1.5rem !important;
                    font-weight: 700 !important;
                    margin-bottom: 8px !important;
                    text-align: center !important;
                }
                .survey-subtitle {
                    color: #718096 !important;
                    font-size: 0.9rem !important;
                    line-height: 1.5 !important;
                    text-align: center !important;
                    margin-bottom: 20px !important;
                }

                /* Form content styling inside modal */
                .form-section-title {
                    font-size: 1.05rem !important;
                    font-weight: 700 !important;
                    color: #7b0000 !important;
                    margin: 20px 0 12px 0 !important;
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                }
                .form-group {
                    margin-bottom: 15px !important;
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 6px !important;
                }
                .form-label {
                    font-weight: 600 !important;
                    font-size: 0.9rem !important;
                    color: #2d3748 !important;
                }
                .form-label span.required {
                    color: #c53030 !important;
                }
                .input-field, .select-field {
                    width: 100% !important;
                    padding: 10px 14px !important;
                    border-radius: 8px !important;
                    border: 1px solid #e2e8f0 !important;
                    outline: none !important;
                    font-size: 0.9rem !important;
                    transition: all 0.2s !important;
                    background-color: #fcfcfc !important;
                    box-sizing: border-box !important;
                }
                .input-field:focus, .select-field:focus {
                    border-color: #7b0000 !important;
                    box-shadow: 0 0 0 3px rgba(123, 0, 0, 0.1) !important;
                    background-color: #fff !important;
                }
                .flex-row-group {
                    display: flex !important;
                    gap: 15px !important;
                    flex-wrap: wrap !important;
                }
                .flex-row-group > .form-group {
                    flex: 1 !important;
                    min-width: 180px !important;
                }
                
                /* Star Rating Styles inside Modal */
                .stars-container {
                    display: flex !important;
                    gap: 8px !important;
                    align-items: center !important;
                }
                .star-rating {
                    font-size: 1.8rem !important;
                    color: #e2e8f0 !important;
                    cursor: pointer !important;
                    transition: all 0.15s ease !important;
                }
                .star-rating.selected, .star-rating:hover {
                    color: #f1c40f !important;
                    transform: scale(1.1) !important;
                }

                /* Features Matrix styling */
                .features-table-container {
                    width: 100% !important;
                    overflow-x: auto !important;
                    margin-top: 10px !important;
                }
                .features-grid {
                    width: 100% !important;
                    border-collapse: collapse !important;
                    font-size: 0.85rem !important;
                }
                .features-grid th {
                    text-align: left !important;
                    padding: 8px !important;
                    font-size: 0.8rem !important;
                    color: #718096 !important;
                    border-bottom: 2px solid #e2e8f0 !important;
                }
                .features-grid td {
                    padding: 10px 8px !important;
                    border-bottom: 1px solid #edf2f7 !important;
                    font-size: 0.85rem !important;
                }
                .features-grid tr:hover {
                    background-color: #fafafa !important;
                }
                .rating-cell-group {
                    display: flex !important;
                    gap: 6px !important;
                }
                .rating-btn {
                    padding: 5px 10px !important;
                    border-radius: 6px !important;
                    border: 1px solid #e2e8f0 !important;
                    font-size: 0.75rem !important;
                    font-weight: 500 !important;
                    cursor: pointer !important;
                    background-color: white !important;
                    transition: all 0.2s !important;
                    color: #4a5568 !important;
                }
                .rating-btn:hover {
                    background-color: #f7fafc !important;
                }
                .rating-btn.active[data-val="Muito Satisfeito"], .rating-btn.active[data-val="Satisfeito"] {
                    background-color: #e6fffa !important;
                    border-color: #319795 !important;
                    color: #234e52 !important;
                }
                .rating-btn.active[data-val="Passivo"] {
                    background-color: #feebc8 !important;
                    border-color: #dd6b20 !important;
                    color: #7b341e !important;
                }
                .rating-btn.active[data-val="Insatisfeito"], .rating-btn.active[data-val="Muito Insatisfeito"] {
                    background-color: #fed7d7 !important;
                    border-color: #e53e3e !important;
                    color: #742a2a !important;
                }
                .rating-btn.active[data-val="Não Utilizo"] {
                    background-color: #edf2f7 !important;
                    border-color: #718096 !important;
                    color: #2d3748 !important;
                }

                /* NPS Slider Styles */
                .nps-slider-container {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 12px !important;
                    background-color: #fdfefe !important;
                    border: 1px dashed #e2e8f0 !important;
                    border-radius: 12px !important;
                    padding: 15px !important;
                    align-items: center !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                }
                .nps-emoji-display {
                    font-size: 2.5rem !important;
                    height: 50px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    transition: all 0.3s ease !important;
                }
                .nps-emoji-label {
                    font-weight: 700 !important;
                    font-size: 1rem !important;
                    margin-top: -5px !important;
                }
                .nps-score-value {
                    font-size: 1.25rem !important;
                    font-weight: 800 !important;
                    color: #7b0000 !important;
                }
                .nps-slider {
                    -webkit-appearance: none !important;
                    width: 100% !important;
                    height: 8px !important;
                    border-radius: 5px !important;
                    background: #e2e8f0 !important;
                    outline: none !important;
                    cursor: pointer !important;
                }
                .nps-slider::-webkit-slider-thumb {
                    -webkit-appearance: none !important;
                    appearance: none !important;
                    width: 22px !important;
                    height: 22px !important;
                    border-radius: 50% !important;
                    background: #7b0000 !important;
                    cursor: pointer !important;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important;
                    transition: transform 0.1s !important;
                }
                .nps-slider::-webkit-slider-thumb:hover {
                    transform: scale(1.15) !important;
                }
                .nps-ticks {
                    display: flex !important;
                    justify-content: space-between !important;
                    width: 100% !important;
                    padding: 0 4px !important;
                    box-sizing: border-box !important;
                }
                .nps-tick {
                    font-size: 0.75rem !important;
                    font-weight: 600 !important;
                    color: #718096 !important;
                }

                /* Button Group */
                .btn-group {
                    display: flex !important;
                    gap: 12px !important;
                    margin-top: 20px !important;
                    width: 100% !important;
                    flex-wrap: wrap !important;
                }
                .btn-submit {
                    background-color: #7b0000 !important;
                    color: white !important;
                    border: none !important;
                    padding: 12px 24px !important;
                    border-radius: 8px !important;
                    font-size: 0.95rem !important;
                    font-weight: 700 !important;
                    cursor: pointer !important;
                    transition: all 0.2s !important;
                    flex: 1.5 !important;
                    min-width: 150px !important;
                    box-shadow: 0 4px 12px rgba(123, 0, 0, 0.15) !important;
                }
                .btn-submit:hover {
                    background-color: #5a0000 !important;
                    transform: translateY(-1px) !important;
                    box-shadow: 0 6px 15px rgba(123, 0, 0, 0.2) !important;
                }
                .btn-cancel {
                    background-color: transparent !important;
                    color: #7b0000 !important;
                    border: 2px solid #7b0000 !important;
                    padding: 10px 24px !important;
                    border-radius: 8px !important;
                    font-size: 0.95rem !important;
                    font-weight: 700 !important;
                    cursor: pointer !important;
                    transition: all 0.2s !important;
                    flex: 1 !important;
                    min-width: 150px !important;
                    text-align: center !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    text-decoration: none !important;
                }
                .btn-cancel:hover {
                    background-color: #fcebeb !important;
                    color: #5a0000 !important;
                    border-color: #5a0000 !important;
                    transform: translateY(-1px) !important;
                }
                .btn-optout {
                    background-color: transparent !important;
                    color: #718096 !important;
                    border: 2px solid #cbd5e0 !important;
                    padding: 10px 24px !important;
                    border-radius: 8px !important;
                    font-size: 0.95rem !important;
                    font-weight: 700 !important;
                    cursor: pointer !important;
                    transition: all 0.2s !important;
                    flex: 1.2 !important;
                    min-width: 150px !important;
                    text-align: center !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    text-decoration: none !important;
                }
                .btn-optout:hover {
                    background-color: #f7fafc !important;
                    color: #2d3748 !important;
                    border-color: #a0aec0 !important;
                    transform: translateY(-1px) !important;
                }
                .survey-success-view {
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    text-align: center !important;
                    padding: 20px 10px !important;
                }
                .survey-success-view i {
                    font-size: 4.5rem !important;
                    color: #2e7d32 !important;
                    margin-bottom: 15px !important;
                }
            `;
            document.head.appendChild(style);
        }

        const titleHTML = `

            <div class="survey-title-section">
                <h1 class="survey-title">Pesquisa de Satisfação</h1>
                <p class="survey-subtitle">Sua opinião é vital para melhorarmos a gestão do nosso projeto.</p>
            </div>
        `;

        const formHTML = `
            <form id="form-satisfacao">
                <!-- Perfil e Frequência -->
                <div class="form-section-title">
                    <i class="fa-solid fa-circle-user"></i> Identificação e Perfil
                </div>
                <div class="flex-row-group">
                    <div class="form-group">
                        <label class="form-label" for="select-funcao">Sua Função no Projeto <span class="required">*</span></label>
                        <select class="select-field" id="select-funcao" required>
                            <option value="" disabled selected>Selecione...</option>
                            <option value="Coordenador Regional">Coordenador Regional</option>
                            <option value="Coordenador Paroquial">Coordenador Paroquial</option>
                            <option value="Colaborador de Equipe">Colaborador de Equipe / Apoio</option>
                            <option value="Administrador">Administrador</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="select-frequencia">Frequência de Uso do Portal <span class="required">*</span></label>
                        <select class="select-field" id="select-frequencia" required>
                            <option value="" disabled selected>Selecione...</option>
                            <option value="Diariamente">Diariamente</option>
                            <option value="Algumas vezes por semana">Algumas vezes por semana</option>
                            <option value="Uma vez por semana">Uma vez por semana</option>
                            <option value="Quinzenalmente ou menos">Quinzenalmente ou menos</option>
                        </select>
                    </div>
                </div>

                <!-- Usabilidade -->
                <div class="form-section-title">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Usabilidade e Experiência
                </div>
                
                <div class="form-group">
                    <label class="form-label">Facilidade de Navegação (encontrar o que precisa) <span class="required">*</span></label>
                    <div class="stars-container" id="stars-navegacao">
                        <i class="fa-solid fa-star star-rating" data-idx="1"></i>
                        <i class="fa-solid fa-star star-rating" data-idx="2"></i>
                        <i class="fa-solid fa-star star-rating" data-idx="3"></i>
                        <i class="fa-solid fa-star star-rating" data-idx="4"></i>
                        <i class="fa-solid fa-star star-rating" data-idx="5"></i>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Visual e Clareza das Telas <span class="required">*</span></label>
                    <div class="stars-container" id="stars-visual">
                        <i class="fa-solid fa-star star-rating" data-idx="1"></i>
                        <i class="fa-solid fa-star star-rating" data-idx="2"></i>
                        <i class="fa-solid fa-star star-rating" data-idx="3"></i>
                        <i class="fa-solid fa-star star-rating" data-idx="4"></i>
                        <i class="fa-solid fa-star star-rating" data-idx="5"></i>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Experiência de Uso no Celular (Mobile)</label>
                    <div class="stars-container" id="stars-celular">
                        <i class="fa-solid fa-star star-rating" data-idx="1"></i>
                        <i class="fa-solid fa-star star-rating" data-idx="2"></i>
                        <i class="fa-solid fa-star star-rating" data-idx="3"></i>
                        <i class="fa-solid fa-star star-rating" data-idx="4"></i>
                        <i class="fa-solid fa-star star-rating" data-idx="5"></i>
                    </div>
                </div>

                <!-- Avaliação de Ferramentas -->
                <div class="form-section-title">
                    <i class="fa-solid fa-puzzle-piece"></i> Avaliação dos Módulos do Portal
                </div>
                
                <table class="features-grid">
                    <thead>
                        <tr>
                            <th>Módulo / Funcionalidade</th>
                            <th>Sua Avaliação</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr data-feat="colaboradores">
                            <td>Cadastro de Colaboradores e Lideranças</td>
                            <td>
                                <div class="rating-cell-group">
                                    <button type="button" class="rating-btn" data-val="Satisfeito">Satisfeito</button>
                                    <button type="button" class="rating-btn" data-val="Passivo">Passivo</button>
                                    <button type="button" class="rating-btn" data-val="Insatisfeito">Insatisfeito</button>
                                    <button type="button" class="rating-btn" data-val="Não Utilizo">Não Utilizo</button>
                                </div>
                            </td>
                        </tr>
                        <tr data-feat="projetos">
                            <td>Gestão de Projetos (Tarefas e Reuniões)</td>
                            <td>
                                <div class="rating-cell-group">
                                    <button type="button" class="rating-btn" data-val="Satisfeito">Satisfeito</button>
                                    <button type="button" class="rating-btn" data-val="Passivo">Passivo</button>
                                    <button type="button" class="rating-btn" data-val="Insatisfeito">Insatisfeito</button>
                                    <button type="button" class="rating-btn" data-val="Não Utilizo">Não Utilizo</button>
                                </div>
                            </td>
                        </tr>
                        <tr data-feat="treinamentos">
                            <td>Gestão de Treinamentos (Agenda e Presenças)</td>
                            <td>
                                <div class="rating-cell-group">
                                    <button type="button" class="rating-btn" data-val="Satisfeito">Satisfeito</button>
                                    <button type="button" class="rating-btn" data-val="Passivo">Passivo</button>
                                    <button type="button" class="rating-btn" data-val="Insatisfeito">Insatisfeito</button>
                                    <button type="button" class="rating-btn" data-val="Não Utilizo">Não Utilizo</button>
                                </div>
                            </td>
                        </tr>
                        <tr data-feat="aniversariantes">
                            <td>Gerenciador de Banners de Aniversariantes</td>
                            <td>
                                <div class="rating-cell-group">
                                    <button type="button" class="rating-btn" data-val="Satisfeito">Satisfeito</button>
                                    <button type="button" class="rating-btn" data-val="Passivo">Passivo</button>
                                    <button type="button" class="rating-btn" data-val="Insatisfeito">Insatisfeito</button>
                                    <button type="button" class="rating-btn" data-val="Não Utilizo">Não Utilizo</button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div class="form-group" style="margin-top: 20px;">
                    <label class="form-label" for="select-erros">Com que frequência você encontra erros/travamentos? <span class="required">*</span></label>
                    <select class="select-field" id="select-erros" required>
                        <option value="" disabled selected>Selecione...</option>
                        <option value="Nunca">Nunca encontro erros</option>
                        <option value="Raramente">Raramente (uma vez ou outra)</option>
                        <option value="Às vezes">Às vezes (em telas pontuais)</option>
                        <option value="Frequentemente">Frequentemente (atrapalha meu uso)</option>
                    </select>
                </div>

                <!-- NPS Slider -->
                <div class="form-section-title">
                    <i class="fa-solid fa-heart-circle-check"></i> Recomendação Geral (NPS)
                </div>
                
                <div class="form-group">
                    <label class="form-label">
                        Em uma escala de 0 a 10, qual a probabilidade de recomendar o Portal da Adoção Espiritual para outro coordenador ou colaborador? <span class="required">*</span>
                    </label>
                    
                    <div class="nps-slider-container">
                        <div class="nps-emoji-display" id="nps-emoji">😐</div>
                        <div class="nps-emoji-label" id="nps-label">Passivo</div>
                        <div class="nps-score-value">Nota: <span id="nps-score-txt">7</span>/10</div>
                        
                        <input type="range" class="nps-slider" id="nps-range" min="0" max="10" value="7">
                        
                        <div class="nps-ticks">
                            <span class="nps-tick">0</span>
                            <span class="nps-tick">1</span>
                            <span class="nps-tick">2</span>
                            <span class="nps-tick">3</span>
                            <span class="nps-tick">4</span>
                            <span class="nps-tick">5</span>
                            <span class="nps-tick">6</span>
                            <span class="nps-tick">7</span>
                            <span class="nps-tick">8</span>
                            <span class="nps-tick">9</span>
                            <span class="nps-tick">10</span>
                        </div>
                    </div>
                </div>

                <!-- Observação -->
                <div class="form-group" style="margin-top: 20px;">
                    <label class="form-label" for="textarea-obs">Como podemos melhorar o portal para apoiar a sua missão? (Sugestões/Críticas)</label>
                    <textarea class="input-field" id="textarea-obs" placeholder="Escreva aqui..." rows="4" maxlength="500" style="resize: vertical;"></textarea>
                    <div style="font-size: 0.8rem; color: #718096; text-align: right; margin-top: -4px;" id="char-counter">0 / 500</div>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn-optout" id="btn-optout">Não desejo responder</button>
                    <button type="button" class="btn-cancel">Responder Depois</button>
                    <button type="submit" class="btn-submit">Responder</button>
                </div>
            </form>
        `;

        overlay.innerHTML = `
            <div class="survey-modal-box">
                <button type="button" class="survey-modal-close-btn" id="survey-modal-close" title="Fechar Janela">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                ${titleHTML}
                <div id="survey-modal-form-container">
                    ${formHTML}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        
        overlay.offsetHeight; // Force reflow
        overlay.classList.add('active');

        initModalSurveyHandlers(overlay);

    }

    function initModalSurveyHandlers(overlay) {
        const closeBtn = overlay.querySelector('#survey-modal-close');
        const form = overlay.querySelector('#form-satisfacao');

        const closeModal = () => {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.remove();
            }, 250);
        };

        if (closeBtn) closeBtn.onclick = closeModal;

        // Defensive generation of "Responder Depois" button if missing in parsed template
        let cancelBtn = overlay.querySelector('.btn-cancel');
        const submitBtn = overlay.querySelector('.btn-submit');
        
        if (!cancelBtn && submitBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn-cancel';
            cancelBtn.innerText = 'Responder Depois';
            
            let btnGroup = overlay.querySelector('.btn-group');
            if (!btnGroup) {
                btnGroup = document.createElement('div');
                btnGroup.className = 'btn-group';
                submitBtn.parentNode.insertBefore(btnGroup, submitBtn);
                btnGroup.appendChild(cancelBtn);
                btnGroup.appendChild(submitBtn);
            } else {
                btnGroup.insertBefore(cancelBtn, submitBtn);
            }
        }
        
        if (cancelBtn) {
            cancelBtn.type = 'button';
            cancelBtn.innerText = 'Responder Depois';
            cancelBtn.onclick = closeModal;
        }

        const optoutBtn = overlay.querySelector('#btn-optout');
        if (optoutBtn) {
            optoutBtn.onclick = async () => {
                const colabId = localStorage.getItem('user_id_colaborador');
                if (!colabId || colabId === 'null' || colabId === 'undefined') {
                    alert('Identificação do colaborador não encontrada. Não é possível salvar a opção de recusa.');
                    return;
                }

                const payload = {
                    id_colaborador: parseInt(colabId),
                    recusado: true
                };

                try {
                    const apiUrl = window.location.protocol === 'file:' ? 'http://localhost:3000/api' : '/api';
                    const res = await fetch(`${apiUrl}/pesquisa_satisfacao/save`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    
                    const result = await res.json();
                    if (res.ok && result.success) {
                        localStorage.setItem('adocao_survey_responded_' + colabId, 'true');
                        const pill = document.getElementById('survey-notification-pill');
                        if (pill) pill.remove();
                        closeModal();
                    } else {
                        throw new Error(result.error || 'Erro ao salvar opção de não responder.');
                    }
                } catch (err) {
                    console.error(err);
                    alert(err.message);
                }
            };
        }

        overlay.onclick = (e) => {
            if (e.target === overlay) closeModal();
        };

        let ratings = {
            navegacao: 0,
            visual: 0,
            celular: 0
        };

        let featureSatisfaction = {
            colaboradores: null,
            projetos: null,
            treinamentos: null,
            aniversariantes: null
        };

        const initStars = (groupName) => {
            const container = overlay.querySelector(`#stars-${groupName}`);
            if (!container) return;
            const stars = container.querySelectorAll('.star-rating');
            
            stars.forEach(star => {
                star.onclick = () => {
                    const val = parseInt(star.getAttribute('data-idx'));
                    ratings[groupName] = val;
                    stars.forEach(s => {
                        const idx = parseInt(s.getAttribute('data-idx'));
                        if (idx <= val) {
                            s.classList.add('selected');
                            s.style.color = '#f1c40f';
                        } else {
                            s.classList.remove('selected');
                            s.style.color = '#e2e8f0';
                        }
                    });
                };

                star.onmouseover = () => {
                    const val = parseInt(star.getAttribute('data-idx'));
                    stars.forEach(s => {
                        const idx = parseInt(s.getAttribute('data-idx'));
                        if (idx <= val) {
                            s.style.color = '#f1c40f';
                        } else {
                            s.style.color = '#e2e8f0';
                        }
                    });
                };

                star.onmouseout = () => {
                    stars.forEach(s => {
                        const idx = parseInt(s.getAttribute('data-idx'));
                        if (ratings[groupName] >= idx) {
                            s.style.color = '#f1c40f';
                        } else {
                            s.style.color = '#e2e8f0';
                        }
                    });
                };
            });
        };

        initStars('navegacao');
        initStars('visual');
        initStars('celular');

        const rows = overlay.querySelectorAll('.features-grid tbody tr');
        rows.forEach(row => {
            const feat = row.getAttribute('data-feat');
            const btns = row.querySelectorAll('.rating-btn');
            
            btns.forEach(btn => {
                btn.onclick = () => {
                    btns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    featureSatisfaction[feat] = btn.getAttribute('data-val');
                };
            });
        });

        const npsRange = overlay.querySelector('#nps-range');
        const updateNPSDisplay = (val) => {
            const scoreTxt = overlay.querySelector('#nps-score-txt');
            const emojiEl = overlay.querySelector('#nps-emoji');
            const labelEl = overlay.querySelector('#nps-label');
            
            if (scoreTxt) scoreTxt.innerText = val;
            
            const n = parseInt(val);
            if (emojiEl && labelEl) {
                if (n <= 4) {
                    emojiEl.innerText = '😢';
                    labelEl.innerText = 'Insatisfeito';
                    labelEl.style.color = '#c53030';
                } else if (n <= 6) {
                    emojiEl.innerText = '😕';
                    labelEl.innerText = 'Insatisfeito';
                    labelEl.style.color = '#c53030';
                } else if (n <= 8) {
                    emojiEl.innerText = '😐';
                    labelEl.innerText = 'Passivo';
                    labelEl.style.color = '#dd6b20';
                } else {
                    emojiEl.innerText = '😁';
                    labelEl.innerText = 'Satisfeito';
                    labelEl.style.color = '#2e7d32';
                }
            }
        };

        if (npsRange) {
            npsRange.oninput = (e) => updateNPSDisplay(e.target.value);
            updateNPSDisplay(7);
        }

        const textareaObs = overlay.querySelector('#textarea-obs');
        const charCounter = overlay.querySelector('#char-counter');
        if (textareaObs && charCounter) {
            textareaObs.oninput = (e) => {
                const len = e.target.value.length;
                charCounter.innerText = `${len} / 500`;
            };
        }

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();

                const funcao = overlay.querySelector('#select-funcao').value;
                const frequencia_uso = overlay.querySelector('#select-frequencia').value;
                const frequencia_erros = overlay.querySelector('#select-erros').value;
                const nps = overlay.querySelector('#nps-range').value;
                const observacao = overlay.querySelector('#textarea-obs').value.trim();
                if (ratings.navegacao === 0 || ratings.visual === 0) {
                    alert('Por favor, avalie a Facilidade de Navegação e o Visual com estrelas.');
                    return;
                }

                const colabId = localStorage.getItem('user_id_colaborador');
                if (!colabId || colabId === 'null' || colabId === 'undefined') {
                    alert('Identificação do colaborador não encontrada. Por favor, faça login novamente para responder a pesquisa.');
                    return;
                }

                const payload = {
                    id_colaborador: colabId ? parseInt(colabId) : null,
                    funcao,
                    frequencia_uso,
                    nota_navegacao: ratings.navegacao,
                    nota_visual: ratings.visual,
                    nota_celular: ratings.celular > 0 ? ratings.celular : null,
                    satisfacao_colaboradores: featureSatisfaction.colaboradores,
                    satisfacao_projetos: featureSatisfaction.projetos,
                    satisfacao_treinamentos: featureSatisfaction.treinamentos,
                    satisfacao_aniversariantes: featureSatisfaction.aniversariantes,
                    frequencia_erros,
                    nps,
                    observacao
                };

                try {
                    const apiUrl = window.location.protocol === 'file:' ? 'http://localhost:3000/api' : '/api';
                    const res = await fetch(`${apiUrl}/pesquisa_satisfacao/save`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    
                    const result = await res.json();
                    if (res.ok && result.success) {
                        localStorage.setItem('adocao_survey_responded_' + colabId, 'true');
                        
                        const pill = document.getElementById('survey-notification-pill');
                        if (pill) pill.remove();

                        const modalFormContainer = overlay.querySelector('#survey-modal-form-container');
                        if (modalFormContainer) {
                            modalFormContainer.innerHTML = `
                                <div class="survey-success-view">
                                    <i class="fa-solid fa-circle-check"></i>
                                    <h2 style="font-size: 1.6rem; font-weight: 700; color: #2d3748; margin-bottom: 12px;">Obrigado pelo seu Feedback!</h2>
                                    <p style="color: #718096; font-size: 0.95rem; max-width: 400px; line-height: 1.5; margin-bottom: 25px;">
                                        Suas respostas foram gravadas e ajudarão nossa equipe a aprimorar o Portal da Adoção Espiritual.
                                    </p>
                                    <button type="button" class="btn-submit" style="width: auto; padding: 12px 30px; margin-top: 10px;" id="survey-success-close">
                                        Fechar Janela
                                    </button>
                                </div>
                            `;
                            overlay.querySelector('#survey-success-close').onclick = closeModal;
                        }
                    } else {
                        throw new Error(result.error || 'Erro ao enviar pesquisa.');
                    }
                } catch (err) {
                    console.error(err);
                    alert(err.message);
                }
            };
        }
    }

    // Attach to global window object
    window.updateUserName = updateUserName;
    window.handlePhotoUpload = handlePhotoUpload;
    window.checkSurveyStatus = checkSurveyStatus;
    window.openSurveyModal = openSurveyModal;

    // Run automatically when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            updateUserName();
            loadDynamicMenu();
            checkSurveyStatus();
            const input = document.getElementById('hidden-photo-input');
            if (input) {
                input.addEventListener('change', handlePhotoUpload);
            }
            
            // Intercept clicks on links pointing to pesquisa_satisfacao.html
            document.addEventListener('click', (e) => {
                const link = e.target.closest('a');
                if (link && link.getAttribute('href') && (link.getAttribute('href') === 'pesquisa_satisfacao.html' || link.getAttribute('href').startsWith('pesquisa_satisfacao.html?'))) {
                    e.preventDefault();
                    openSurveyModal();
                }
            });
        });
    } else {
        updateUserName();
        loadDynamicMenu();
        checkSurveyStatus();
        const input = document.getElementById('hidden-photo-input');
        if (input) {
            input.addEventListener('change', handlePhotoUpload);
        }
        
        // Intercept clicks on links pointing to pesquisa_satisfacao.html
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.getAttribute('href') && (link.getAttribute('href') === 'pesquisa_satisfacao.html' || link.getAttribute('href').startsWith('pesquisa_satisfacao.html?'))) {
                e.preventDefault();
                openSurveyModal();
            }
        });
    }
})();
