// Sistema de Controle de Estoque LORD Inventory System
// Arquivo: script.js

// ============ CONSTANTES E CONFIGURAÇÕES ============
const STORAGE_KEY = 'lord_inventory_data_v2';
const APP_VERSION = '2.0';
const DATE_FORMAT = 'dd/mm/yyyy';

// ============ DADOS INICIAIS ============
const initialData = {
    version: APP_VERSION,
    lastUpdated: new Date().toISOString(),
    products: [] 
};
// ============ ESTADO DO SISTEMA ============
let state = {
    data: null,
    editingProduct: null,
    charts: {
        line: null,
        bar: null
    },
    filters: {
        stock: 'all',
        entryMonth: null,
        outputMonth: null
    }
};

// ============ FUNÇÕES DE UTILIDADE ============
const utils = {
    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    },
    
    parseDate(dateStr) {
        if (!dateStr) return new Date();
        const [day, month, year] = dateStr.split('/');
        return new Date(year, month - 1, day);
    },
    
    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    },
    
    calculateCurrentStock(product) {
        const totalEntradas = product.entradas.reduce((sum, e) => sum + e.qty, 0);
        const totalSaidas = product.saidas.reduce((sum, s) => sum + s.qty, 0);
        return totalEntradas - totalSaidas;
    },
    
    calculateProductMetrics(product) {
        const currentStock = this.calculateCurrentStock(product);
        const totalCost = product.entradas.reduce((sum, e) => sum + e.total, 0);
        const totalRevenue = product.saidas.reduce((sum, s) => sum + s.total, 0);
        const profit = totalRevenue - totalCost;
        
        let status = 'ok';
        if (currentStock < product.min) {
            status = 'danger';
        } else if (currentStock < product.des) {
            status = 'warning';
        }
        
        return {
            currentStock,
            totalCost,
            totalRevenue,
            profit,
            status
        };
    },
    
    calculateGlobalMetrics() {
        if (!state.data) return null;
        
        let totalStock = 0;
        let totalCost = 0;
        let totalRevenue = 0;
        let totalProfit = 0;
        
        state.data.products.forEach(product => {
            const metrics = this.calculateProductMetrics(product);
            totalStock += metrics.currentStock;
            totalCost += metrics.totalCost;
            totalRevenue += metrics.totalRevenue;
            totalProfit += metrics.profit;
        });
        
        return {
            totalStock,
            totalCost,
            totalRevenue,
            totalProfit
        };
    },
    
    validateStockAvailability(productId, quantity) {
        const product = state.data.products.find(p => p.id === productId);
        if (!product) return false;
        
        const currentStock = this.calculateCurrentStock(product);
        return currentStock >= quantity;
    },
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
};

// ============ GERENCIAMENTO DE DADOS ============
const dataManager = {
    load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                state.data = JSON.parse(saved);
                console.log('Dados carregados do localStorage');
            } else {
                this.reset();
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.reset();
        }
    },
    
    save() {
        try {
            state.data.lastUpdated = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
            
            // Atualizar visualização de armazenamento
            const storageSize = JSON.stringify(state.data).length;
            const maxSize = 5 * 1024 * 1024; // 5MB
            const percentage = (storageSize / maxSize) * 100;
            document.getElementById('storageFill').style.width = `${Math.min(percentage, 100)}%`;
            
            document.getElementById('lastSave').textContent = 
                `Último salvo: ${utils.formatDate(new Date())} ${new Date().toLocaleTimeString()}`;
                
            console.log('Dados salvos no localStorage');
            return true;
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
            uiManager.showToast('Erro ao salvar dados', 'error');
            return false;
        }
    },
    
    reset() {
        state.data = JSON.parse(JSON.stringify(initialData));
        this.save();
        uiManager.init();
        uiManager.showToast('Dados restaurados com sucesso!', 'success');
    },
    
    addProduct(productData) {
        const newProduct = {
            id: productData.id || `XC${String(state.data.products.length + 1).padStart(3, '0')}`,
            name: productData.name,
            min: Number(productData.min),
            des: Number(productData.des),
            cost: Number(productData.cost),
            price: Number(productData.price),
            entradas: [],
            saidas: []
        };
        
        state.data.products.push(newProduct);
        this.save();
        return newProduct.id;
    },
    
    updateProduct(id, updates) {
        const index = state.data.products.findIndex(p => p.id === id);
        if (index !== -1) {
            state.data.products[index] = { ...state.data.products[index], ...updates };
            this.save();
            return true;
        }
        return false;
    },
    
    deleteProduct(id) {
        state.data.products = state.data.products.filter(p => p.id !== id);
        this.save();
        return true;
    },
    
    addEntry(productId, entryData) {
        const product = state.data.products.find(p => p.id === productId);
        if (!product) return false;
        
        const entry = {
            id: `E${utils.generateId()}`,
            data: entryData.data || utils.formatDate(new Date()),
            tipo: entryData.tipo,
            qty: Number(entryData.qty),
            cost_unit: Number(entryData.cost_unit || product.cost),
            total: Number(entryData.qty) * Number(entryData.cost_unit || product.cost)
        };
        
        product.entradas.push(entry);
        this.save();
        return entry.id;
    },
    
    addOutput(productId, outputData) {
        const product = state.data.products.find(p => p.id === productId);
        if (!product) return false;
        
        const currentStock = utils.calculateCurrentStock(product);
        if (currentStock < outputData.qty) {
            throw new Error(`Estoque insuficiente. Disponível: ${currentStock}, Solicitado: ${outputData.qty}`);
        }
        
        const output = {
            id: `S${utils.generateId()}`,
            data: outputData.data || utils.formatDate(new Date()),
            qty: Number(outputData.qty),
            price_unit: Number(outputData.price_unit || product.price),
            total: Number(outputData.qty) * Number(outputData.price_unit || product.price)
        };
        
        product.saidas.push(output);
        this.save();
        return output.id;
    },
    
    getPurchaseSuggestions() {
        const suggestions = [];
        let alertCount = 0;
        let reorderCount = 0;
        let estimatedCost = 0;
        
        state.data.products.forEach(product => {
            const currentStock = utils.calculateCurrentStock(product);
            const metrics = utils.calculateProductMetrics(product);
            
            if (currentStock < product.des) {
                const missing = product.des - currentStock;
                const unitCost = product.cost;
                const totalCost = missing * unitCost;
                
                let priority = 'baixa';
                let action = 'Repor gradualmente';
                
                if (currentStock < product.min) {
                    priority = 'alta';
                    action = 'COMPRAR URGENTE';
                    alertCount++;
                } else {
                    priority = 'média';
                    action = 'Planejar compra';
                    reorderCount++;
                }
                
                if (currentStock < product.des) {
                    estimatedCost += totalCost;
                }
                
                suggestions.push({
                    product: product.name,
                    currentStock,
                    min: product.min,
                    des: product.des,
                    missing,
                    unitCost,
                    totalCost,
                    priority,
                    action
                });
            }
        });
        
        // Ordenar por prioridade (alta primeiro)
        suggestions.sort((a, b) => {
            const priorityOrder = { alta: 0, média: 1, baixa: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
        
        return {
            suggestions,
            alertCount,
            reorderCount,
            estimatedCost
        };
    }
};

// ============ GERENCIAMENTO DE INTERFACE ============
const uiManager = {
    init() {
        this.setupEventListeners();
        this.setupAutoDateUpdate(); // <-- LINHA NOVA ADICIONADA 18/01/2026
        this.loadProducts();
        this.updateDashboard();
        this.updateCharts();
        this.updatePurchaseSuggestions();
        this.updateLastSave();
        
        // Carregar dados iniciais se não existirem
        if (!state.data) {
            dataManager.load();
        }
    },
    
    setupAutoDateUpdate() {
        // Atualizar data uma vez ao carregar
        this.updateCurrentDate();
        
        // Atualizar a cada minuto (para garantir que a data está correta)
        setInterval(() => {
            this.updateCurrentDate();
        }, 60000); // 60 segundos
        
        // Verificar se a data mudou a cada hora
        setInterval(() => {
            const hoje = new Date().toDateString();
            if (this.lastDateChecked !== hoje) {
                this.updateCurrentDate();
                this.lastDateChecked = hoje;
                
                // Atualizar também as datas padrão nos formulários
                const hojeInput = new Date().toISOString().split('T')[0];
                document.getElementById('entryDate').value = hojeInput;
                document.getElementById('outputDate').value = hojeInput;
            }
        }, 3600000); 
        // 1 hora
    },
    
    updateCurrentDate() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const dataFormatada = now.toLocaleDateString('pt-BR', options);
        document.getElementById('currentDate').textContent = 
            `Hoje é ${dataFormatada}`;
    },
    
    // ... o resto das funções permanece IGUAL ...
    
    setupEventListeners() {
        // Navegação do menu
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.getAttribute('data-section');
                this.showSection(section);
                
                // Atualizar menu ativo
                document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                // Atualizar título da seção
                const sectionNames = {
                    dashboard: 'Dashboard',
                    cadastro: 'Cadastro de Produtos',
                    entrada: 'Registro de Entrada',
                    saida: 'Registro de Saída',
                    controle: 'Controle de Estoque',
                    compras: 'Sugestões de Compras'
                };
                document.getElementById('currentSection').textContent = sectionNames[section] || 'Dashboard';
            });
        });
        
        // Formulário de produto
        document.getElementById('productForm').addEventListener('submit', this.handleProductSubmit.bind(this));
        document.getElementById('clearForm').addEventListener('click', this.clearProductForm.bind(this));
        document.getElementById('cancelEdit').addEventListener('click', this.cancelEditProduct.bind(this));
        
        // Formulário de entrada
        document.getElementById('entryForm').addEventListener('submit', this.handleEntrySubmit.bind(this));
        document.getElementById('entryQuantity').addEventListener('input', this.calculateEntryTotal.bind(this));
        document.getElementById('entryCost').addEventListener('input', this.calculateEntryTotal.bind(this));
        document.getElementById('entryProduct').addEventListener('change', this.updateEntryProductInfo.bind(this));
        
        // Formulário de saída
        document.getElementById('outputForm').addEventListener('submit', this.handleOutputSubmit.bind(this));
        document.getElementById('outputQuantity').addEventListener('input', this.calculateOutputTotal.bind(this));
        document.getElementById('outputPrice').addEventListener('input', this.calculateOutputTotal.bind(this));
        document.getElementById('outputProduct').addEventListener('change', this.updateOutputProductInfo.bind(this));
        
        // Botões de ação
        document.getElementById('resetBtn').addEventListener('click', this.handleResetData.bind(this));
        document.getElementById('exportCSV').addEventListener('click', this.handleExportCSV.bind(this));
        document.getElementById('refreshBtn').addEventListener('click', this.refreshData.bind(this));
        document.getElementById('runSimulation').addEventListener('click', this.handleSimulation.bind(this));
        
        // Filtros
        document.getElementById('stockFilter').addEventListener('change', this.handleStockFilter.bind(this));
        document.getElementById('filterEntryMonth').addEventListener('change', this.filterEntriesByMonth.bind(this));
        document.getElementById('filterOutputMonth').addEventListener('change', this.filterOutputsByMonth.bind(this));
        
        // Modal
        document.getElementById('modalClose').addEventListener('click', this.hideModal.bind(this));
        document.getElementById('modalCancel').addEventListener('click', this.hideModal.bind(this));
        
        // Busca
        document.getElementById('searchProducts').addEventListener('input', this.searchProducts.bind(this));
    },
    
    showSection(sectionId) {
        // Esconder todas as seções
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Mostrar seção selecionada
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.add('active');
            
            // Atualizar dados específicos da seção
            switch(sectionId) {
                case 'cadastro':
                    this.updateProductsTable();
                    break;
                case 'entrada':
                    this.populateProductSelect('entryProduct');
                    this.updateEntriesTable();
                    break;
                case 'saida':
                    this.populateProductSelect('outputProduct');
                    this.updateOutputsTable();
                    break;
                case 'controle':
                    this.updateStockTable();
                    break;
                case 'compras':
                    this.updatePurchaseSuggestions();
                    break;
            }
        }
    },
    
    updateCurrentDate() {
        const now = new Date();
        document.getElementById('currentDate').textContent = 
            `Hoje é ${utils.formatDate(now)}`;
    },
    
    loadProducts() {
        this.populateProductSelect('entryProduct');
        this.populateProductSelect('outputProduct');
        this.updateProductsTable();
        this.updateEntriesTable();
        this.updateOutputsTable();
        this.updateStockTable();
    },
    
    populateProductSelect(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        // Salvar seleção atual
        const currentValue = select.value;
        
        // Limpar opções (exceto a primeira)
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Adicionar produtos
        if (state.data && state.data.products) {
            state.data.products.forEach(product => {
                const option = document.createElement('option');
                option.value = product.id;
                option.textContent = `${product.name} (Estoque: ${utils.calculateCurrentStock(product)})`;
                select.appendChild(option);
            });
        }
        
        // Restaurar seleção se ainda existir
        if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
            select.value = currentValue;
        }
    },
    
    updateDashboard() {
        if (!state.data) return;
        
        const metrics = utils.calculateGlobalMetrics();
        if (!metrics) return;
        
        // Atualizar métricas
        document.getElementById('totalStock').textContent = metrics.totalStock;
        document.getElementById('totalCost').textContent = utils.formatCurrency(metrics.totalCost);
        document.getElementById('totalRevenue').textContent = utils.formatCurrency(metrics.totalRevenue);
        document.getElementById('totalProfit').textContent = utils.formatCurrency(metrics.totalProfit);
        
        // Atualizar alertas
        this.updateAlerts();
    },
    
    updateAlerts() {
        const alertsGrid = document.getElementById('alertsGrid');
        if (!alertsGrid) return;
        
        let alertCount = 0;
        let alertsHTML = '';
        
        state.data.products.forEach(product => {
            const currentStock = utils.calculateCurrentStock(product);
            const metrics = utils.calculateProductMetrics(product);
            
            if (metrics.status === 'danger') {
                alertCount++;
                alertsHTML += `
                    <div class="alert-item alert-danger">
                        <i class="fas fa-exclamation-triangle"></i>
                        <div class="alert-content">
                            <strong>${product.name}</strong>
                            <p>Estoque zerado! Mínimo: ${product.min} unidades</p>
                        </div>
                    </div>
                `;
            } else if (metrics.status === 'warning') {
                alertsHTML += `
                    <div class="alert-item alert-warning">
                        <i class="fas fa-exclamation-circle"></i>
                        <div class="alert-content">
                            <strong>${product.name}</strong>
                            <p>Estoque abaixo do desejável: ${currentStock}/${product.des} unidades</p>
                        </div>
                    </div>
                `;
            }
        });
        
        if (alertsHTML === '') {
            alertsHTML = `
                <div class="alert-placeholder">
                    <i class="fas fa-check-circle"></i>
                    <p>Nenhum alerta no momento</p>
                </div>
            `;
        }
        
        alertsGrid.innerHTML = alertsHTML;
        document.getElementById('alertCount').textContent = alertCount;
    },
    
    updateCharts() {
        this.updateLineChart();
        this.updateBarChart();
    },
    
    updateLineChart() {
        const ctx = document.getElementById('lineChart');
        if (!ctx) return;
        
        // Se já existe um gráfico, destruir
        if (state.charts.line) {
            state.charts.line.destroy();
        }
        
        // Dados do gráfico de linha
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const currentMonth = new Date().getMonth();
        const labels = months.slice(0, currentMonth + 1);
        
        // Calcular saldo acumulado por mês
        const balances = labels.map((_, index) => {
            let balance = 0;
            state.data.products.forEach(product => {
                // Entradas do mês
                product.entradas.forEach(entrada => {
                    const entradaDate = utils.parseDate(entrada.data);
                    if (entradaDate.getMonth() === index) {
                        balance += entrada.qty;
                    }
                });
                
                // Saídas do mês
                product.saidas.forEach(saida => {
                    const saidaDate = utils.parseDate(saida.data);
                    if (saidaDate.getMonth() === index) {
                        balance -= saida.qty;
                    }
                });
            });
            return balance;
        });
        
        // Calcular saldo acumulado
        let cumulative = 0;
        const cumulativeBalances = balances.map(balance => {
            cumulative += balance;
            return cumulative;
        });
        
        state.charts.line = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Saldo Acumulado',
                    data: cumulativeBalances,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    },
    
    updateBarChart() {
        const ctx = document.getElementById('barChart');
        if (!ctx) return;
        
        if (state.charts.bar) {
            state.charts.bar.destroy();
        }
        
        const products = state.data.products;
        const labels = products.map(p => p.name);
        const currentStock = products.map(p => utils.calculateCurrentStock(p));
        const minStock = products.map(p => p.min);
        const desStock = products.map(p => p.des);
        
        state.charts.bar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Estoque Atual',
                        data: currentStock,
                        backgroundColor: '#3b82f6',
                        borderColor: '#2563eb',
                        borderWidth: 1
                    },
                    {
                        label: 'Estoque Mínimo',
                        data: minStock,
                        backgroundColor: '#10b981',
                        borderColor: '#0da271',
                        borderWidth: 1
                    },
                    {
                        label: 'Estoque Desejável',
                        data: desStock,
                        backgroundColor: '#f59e0b',
                        borderColor: '#d97706',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            padding: 20
                        }
                    }
                }
            }
        });
    },
    
    updateProductsTable() {
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;
        
        let html = '';
        state.data.products.forEach(product => {
            const currentStock = utils.calculateCurrentStock(product);
            const metrics = utils.calculateProductMetrics(product);
            
            html += `
                <tr>
                    <td>${product.id}</td>
                    <td>${product.name}</td>
                    <td>${product.min}</td>
                    <td>${product.des}</td>
                    <td>${utils.formatCurrency(product.cost)}</td>
                    <td>${utils.formatCurrency(product.price)}</td>
                    <td>
                        <span class="${metrics.status === 'danger' ? 'status-indicator status-danger' : metrics.status === 'warning' ? 'status-indicator status-warning' : 'status-indicator status-ok'}"></span>
                        ${currentStock}
                    </td>
                    <td>
                        <button class="btn-icon btn-edit" data-id="${product.id}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-delete" data-id="${product.id}" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
        // Adicionar event listeners para os botões
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.currentTarget.getAttribute('data-id');
                this.editProduct(productId);
            });
        });
        
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.currentTarget.getAttribute('data-id');
                this.deleteProduct(productId);
            });
        });
    },
    
    updateEntriesTable() {
        const tbody = document.getElementById('entriesTableBody');
        if (!tbody) return;
        
        let html = '';
        let allEntries = [];
        
        // Coletar todas as entradas
        state.data.products.forEach(product => {
            product.entradas.forEach(entrada => {
                allEntries.push({
                    ...entrada,
                    productName: product.name,
                    productId: product.id
                });
            });
        });
        
        // Ordenar por data (mais recente primeiro)
        allEntries.sort((a, b) => {
            return new Date(utils.parseDate(b.data)) - new Date(utils.parseDate(a.data));
        });
        
        // Renderizar
        allEntries.forEach(entrada => {
            html += `
                <tr>
                    <td>${entrada.data}</td>
                    <td>${entrada.productName}</td>
                    <td>${entrada.tipo}</td>
                    <td>${entrada.qty}</td>
                    <td>${utils.formatCurrency(entrada.cost_unit)}</td>
                    <td>${utils.formatCurrency(entrada.total)}</td>
                    <td>
                        <button class="btn-icon btn-remove-entry" data-id="${entrada.id}" data-product="${entrada.productId}" title="Remover">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
        // Adicionar event listeners para remover entradas
        document.querySelectorAll('.btn-remove-entry').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const entryId = e.currentTarget.getAttribute('data-id');
                const productId = e.currentTarget.getAttribute('data-product');
                this.removeEntry(productId, entryId);
            });
        });
    },
    
    updateOutputsTable() {
        const tbody = document.getElementById('outputsTableBody');
        if (!tbody) return;
        
        let html = '';
        let allOutputs = [];
        
        state.data.products.forEach(product => {
            product.saidas.forEach(saida => {
                allOutputs.push({
                    ...saida,
                    productName: product.name,
                    productId: product.id
                });
            });
        });
        
        // Ordenar por data (mais recente primeiro)
        allOutputs.sort((a, b) => {
            return new Date(utils.parseDate(b.data)) - new Date(utils.parseDate(a.data));
        });
        
        allOutputs.forEach(saida => {
            html += `
                <tr>
                    <td>${saida.data}</td>
                    <td>${saida.productName}</td>
                    <td>${saida.qty}</td>
                    <td>${utils.formatCurrency(saida.price_unit)}</td>
                    <td>${utils.formatCurrency(saida.total)}</td>
                    <td>
                        <button class="btn-icon btn-remove-output" data-id="${saida.id}" data-product="${saida.productId}" title="Remover">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
        document.querySelectorAll('.btn-remove-output').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const outputId = e.currentTarget.getAttribute('data-id');
                const productId = e.currentTarget.getAttribute('data-product');
                this.removeOutput(productId, outputId);
            });
        });
    },
    
    updateStockTable() {
        const tbody = document.getElementById('stockTableBody');
        const tfoot = document.getElementById('stockTableFooter');
        if (!tbody || !tfoot) return;
        
        let html = '';
        let totalEntradas = 0;
        let totalSaidas = 0;
        let totalMin = 0;
        let totalDes = 0;
        let totalAtual = 0;
        let totalCusto = 0;
        let totalFaturamento = 0;
        let totalLucro = 0;
        
        const filter = document.getElementById('stockFilter')?.value || 'all';
        
        state.data.products.forEach(product => {
            const metrics = utils.calculateProductMetrics(product);
            const totalEntradasProd = product.entradas.reduce((sum, e) => sum + e.qty, 0);
            const totalSaidasProd = product.saidas.reduce((sum, s) => sum + s.qty, 0);
            
            // Aplicar filtro
            if (filter === 'ok' && metrics.status !== 'ok') return;
            if (filter === 'warning' && metrics.status !== 'warning') return;
            if (filter === 'danger' && metrics.status !== 'danger') return;
            
            totalEntradas += totalEntradasProd;
            totalSaidas += totalSaidasProd;
            totalMin += product.min;
            totalDes += product.des;
            totalAtual += metrics.currentStock;
            totalCusto += metrics.totalCost;
            totalFaturamento += metrics.totalRevenue;
            totalLucro += metrics.profit;
            
            let statusClass = '';
            let statusText = '';
            if (metrics.status === 'danger') {
                statusClass = 'status-danger';
                statusText = 'ALERTA';
            } else if (metrics.status === 'warning') {
                statusClass = 'status-warning';
                statusText = 'ATENÇÃO';
            } else {
                statusClass = 'status-ok';
                statusText = 'OK';
            }
            
            html += `
                <tr>
                    <td>${product.name}</td>
                    <td>${totalEntradasProd}</td>
                    <td>${totalSaidasProd}</td>
                    <td>${product.min}</td>
                    <td>${product.des}</td>
                    <td>${metrics.currentStock}</td>
                    <td>
                        <span class="status-indicator ${statusClass}"></span>
                        ${statusText}
                    </td>
                    <td>${utils.formatCurrency(metrics.totalCost)}</td>
                    <td>${utils.formatCurrency(metrics.totalRevenue)}</td>
                    <td>${utils.formatCurrency(metrics.profit)}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
        // Rodapé com totais
        tfoot.innerHTML = `
            <tr>
                <td><strong>TOTAIS</strong></td>
                <td><strong>${totalEntradas}</strong></td>
                <td><strong>${totalSaidas}</strong></td>
                <td><strong>${totalMin}</strong></td>
                <td><strong>${totalDes}</strong></td>
                <td><strong>${totalAtual}</strong></td>
                <td></td>
                <td><strong>${utils.formatCurrency(totalCusto)}</strong></td>
                <td><strong>${utils.formatCurrency(totalFaturamento)}</strong></td>
                <td><strong>${utils.formatCurrency(totalLucro)}</strong></td>
            </tr>
        `;
    },
    
    updatePurchaseSuggestions() {
        const suggestions = dataManager.getPurchaseSuggestions();
        
        // Atualizar métricas
        document.getElementById('alertProducts').textContent = suggestions.alertCount;
        document.getElementById('reorderProducts').textContent = suggestions.reorderCount;
        document.getElementById('estimatedCost').textContent = utils.formatCurrency(suggestions.estimatedCost);
        
        // Atualizar tabela
        const tbody = document.getElementById('purchasesTableBody');
        if (!tbody) return;
        
        let html = '';
        suggestions.suggestions.forEach(suggestion => {
            let priorityClass = '';
            if (suggestion.priority === 'alta') priorityClass = 'priority-high';
            else if (suggestion.priority === 'média') priorityClass = 'priority-medium';
            else priorityClass = 'priority-low';
            
            html += `
                <tr class="${priorityClass}">
                    <td>${suggestion.product}</td>
                    <td>${suggestion.currentStock}</td>
                    <td>${suggestion.min}</td>
                    <td>${suggestion.des}</td>
                    <td>${suggestion.missing}</td>
                    <td>${utils.formatCurrency(suggestion.unitCost)}</td>
                    <td>${utils.formatCurrency(suggestion.totalCost)}</td>
                    <td>
                        <span class="priority-badge ${priorityClass}">${suggestion.priority.toUpperCase()}</span>
                    </td>
                    <td>${suggestion.action}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    },
    
    updateLastSave() {
        if (state.data && state.data.lastUpdated) {
            const lastSave = new Date(state.data.lastUpdated);
            document.getElementById('lastSave').textContent = 
                `Último salvo: ${utils.formatDate(lastSave)} ${lastSave.toLocaleTimeString()}`;
        }
    },
    
    // ============ HANDLERS DE FORMULÁRIOS ============
    
    handleProductSubmit(e) {
        e.preventDefault();
        
        const productData = {
            name: document.getElementById('productName').value,
            min: document.getElementById('productMin').value,
            des: document.getElementById('productDes').value,
            cost: document.getElementById('productCost').value,
            price: document.getElementById('productPrice').value
        };
        
        if (state.editingProduct) {
            // Atualizar produto existente
            const success = dataManager.updateProduct(state.editingProduct.id, productData);
            if (success) {
                this.showToast('Produto atualizado com sucesso!', 'success');
                state.editingProduct = null;
                document.getElementById('cancelEdit').style.display = 'none';
            }
        } else {
            // Adicionar novo produto
            const productId = dataManager.addProduct(productData);
            if (productId) {
                this.showToast('Produto cadastrado com sucesso!', 'success');
            }
        }
        
        this.clearProductForm();
        this.updateProductsTable();
        this.populateProductSelect('entryProduct');
        this.populateProductSelect('outputProduct');
        this.updateDashboard();
        this.updateCharts();
        this.updatePurchaseSuggestions();
    },
    
    clearProductForm() {
        document.getElementById('productForm').reset();
        document.getElementById('productId').value = '';
        document.getElementById('productName').focus();
        state.editingProduct = null;
        document.getElementById('cancelEdit').style.display = 'none';
    },
    
    editProduct(productId) {
        const product = state.data.products.find(p => p.id === productId);
        if (!product) return;
        
        state.editingProduct = product;
        
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productMin').value = product.min;
        document.getElementById('productDes').value = product.des;
        document.getElementById('productCost').value = product.cost;
        document.getElementById('productPrice').value = product.price;
        
        document.getElementById('cancelEdit').style.display = 'inline-flex';
        document.getElementById('productName').focus();
    },
    
    cancelEditProduct() {
        this.clearProductForm();
    },
    
    deleteProduct(productId) {
        this.showModal(
            'Excluir Produto',
            'Tem certeza que deseja excluir este produto? Todas as entradas e saídas relacionadas também serão excluídas.',
            () => {
                const success = dataManager.deleteProduct(productId);
                if (success) {
                    this.showToast('Produto excluído com sucesso!', 'success');
                    this.updateProductsTable();
                    this.populateProductSelect('entryProduct');
                    this.populateProductSelect('outputProduct');
                    this.updateDashboard();
                    this.updateCharts();
                    this.updatePurchaseSuggestions();
                }
            }
        );
    },
    
    handleEntrySubmit(e) {
        e.preventDefault();
        
        const productId = document.getElementById('entryProduct').value;
        const qty = document.getElementById('entryQuantity').value;
        const tipo = document.getElementById('entryType').value;
        const cost = document.getElementById('entryCost').value;
        const data = document.getElementById('entryDate').value;
        
        if (!productId || !qty || !tipo) {
            this.showToast('Preencha todos os campos obrigatórios!', 'error');
            return;
        }
        
        const entryData = {
            qty: qty,
            tipo: tipo,
            cost_unit: cost || undefined,
            data: data ? new Date(data).toLocaleDateString('pt-BR') : undefined
        };
        
        try {
            const entryId = dataManager.addEntry(productId, entryData);
            if (entryId) {
                this.showToast('Entrada registrada com sucesso!', 'success');
                document.getElementById('entryForm').reset();
                document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];
                this.updateEntriesTable();
                this.updateDashboard();
                this.updateCharts();
                this.updatePurchaseSuggestions();
                
                // Atualizar info do produto
                this.updateEntryProductInfo();
            }
        } catch (error) {
            this.showToast(`Erro: ${error.message}`, 'error');
        }
    },
    
    calculateEntryTotal() {
        const qty = parseFloat(document.getElementById('entryQuantity').value) || 0;
        const cost = parseFloat(document.getElementById('entryCost').value) || 0;
        const productId = document.getElementById('entryProduct').value;
        
        let unitCost = cost;
        if (!unitCost && productId) {
            const product = state.data.products.find(p => p.id === productId);
            if (product) unitCost = product.cost;
        }
        
        const total = qty * unitCost;
        document.getElementById('entryTotal').value = utils.formatCurrency(total);
    },
    
    updateEntryProductInfo() {
        const productId = document.getElementById('entryProduct').value;
        if (!productId) {
            document.getElementById('currentStockInfo').textContent = '';
            return;
        }
        
        const product = state.data.products.find(p => p.id === productId);
        if (product) {
            const currentStock = utils.calculateCurrentStock(product);
            document.getElementById('currentStockInfo').textContent = 
                `Estoque atual: ${currentStock} unidades`;
            
            // Atualizar custo unitário se não estiver preenchido
            if (!document.getElementById('entryCost').value) {
                document.getElementById('entryCost').value = product.cost;
                this.calculateEntryTotal();
            }
        }
    },
    
    handleOutputSubmit(e) {
        e.preventDefault();
        
        const productId = document.getElementById('outputProduct').value;
        const qty = document.getElementById('outputQuantity').value;
        const price = document.getElementById('outputPrice').value;
        const data = document.getElementById('outputDate').value;
        
        if (!productId || !qty) {
            this.showToast('Preencha todos os campos obrigatórios!', 'error');
            return;
        }
        
        // Verificar estoque
        const product = state.data.products.find(p => p.id === productId);
        const currentStock = utils.calculateCurrentStock(product);
        
        if (currentStock < qty) {
            this.showToast(`Estoque insuficiente! Disponível: ${currentStock} unidades`, 'error');
            return;
        }
        
        const outputData = {
            qty: qty,
            price_unit: price || undefined,
            data: data ? new Date(data).toLocaleDateString('pt-BR') : undefined
        };
        
        try {
            const outputId = dataManager.addOutput(productId, outputData);
            if (outputId) {
                this.showToast('Saída registrada com sucesso!', 'success');
                document.getElementById('outputForm').reset();
                document.getElementById('outputQuantity').value = 1;
                document.getElementById('outputDate').value = new Date().toISOString().split('T')[0];
                this.updateOutputsTable();
                this.updateDashboard();
                this.updateCharts();
                this.updatePurchaseSuggestions();
                
                // Atualizar info do produto
                this.updateOutputProductInfo();
            }
        } catch (error) {
            this.showToast(`Erro: ${error.message}`, 'error');
        }
    },
    
    calculateOutputTotal() {
        const qty = parseFloat(document.getElementById('outputQuantity').value) || 0;
        const price = parseFloat(document.getElementById('outputPrice').value) || 0;
        const productId = document.getElementById('outputProduct').value;
        
        let unitPrice = price;
        if (!unitPrice && productId) {
            const product = state.data.products.find(p => p.id === productId);
            if (product) unitPrice = product.price;
        }
        
        const total = qty * unitPrice;
        document.getElementById('outputTotal').value = utils.formatCurrency(total);
    },
    
    updateOutputProductInfo() {
        const productId = document.getElementById('outputProduct').value;
        const qtyInput = document.getElementById('outputQuantity');
        const stockError = document.getElementById('stockError');
        const maxStockHint = document.getElementById('maxStockHint');
        const availableStockInfo = document.getElementById('availableStockInfo');
        
        if (!productId) {
            availableStockInfo.textContent = '';
            maxStockHint.textContent = '';
            stockError.textContent = '';
            return;
        }
        
        const product = state.data.products.find(p => p.id === productId);
        if (product) {
            const currentStock = utils.calculateCurrentStock(product);
            availableStockInfo.textContent = `Estoque disponível: ${currentStock} unidades`;
            maxStockHint.textContent = `Máximo: ${currentStock} unidades`;
            
            // Verificar se a quantidade solicitada é maior que o estoque
            const requestedQty = parseFloat(qtyInput.value) || 0;
            if (requestedQty > currentStock) {
                stockError.textContent = `Estoque insuficiente! Disponível: ${currentStock}`;
            } else {
                stockError.textContent = '';
            }
            
            // Atualizar preço unitário se não estiver preenchido
            if (!document.getElementById('outputPrice').value) {
                document.getElementById('outputPrice').value = product.price;
                this.calculateOutputTotal();
            }
        }
    },
    
    removeEntry(productId, entryId) {
        this.showModal(
            'Remover Entrada',
            'Tem certeza que deseja remover esta entrada?',
            () => {
                const product = state.data.products.find(p => p.id === productId);
                if (product) {
                    product.entradas = product.entradas.filter(e => e.id !== entryId);
                    dataManager.save();
                    this.showToast('Entrada removida com sucesso!', 'success');
                    this.updateEntriesTable();
                    this.updateDashboard();
                    this.updateCharts();
                    this.updatePurchaseSuggestions();
                }
            }
        );
    },
    
    removeOutput(productId, outputId) {
        this.showModal(
            'Remover Saída',
            'Tem certeza que deseja remover esta saída?',
            () => {
                const product = state.data.products.find(p => p.id === productId);
                if (product) {
                    product.saidas = product.saidas.filter(s => s.id !== outputId);
                    dataManager.save();
                    this.showToast('Saída removida com sucesso!', 'success');
                    this.updateOutputsTable();
                    this.updateDashboard();
                    this.updateCharts();
                    this.updatePurchaseSuggestions();
                }
            }
        );
    },
    
    // ============ HANDLERS DE BOTÕES ============
    
    handleResetData() {
        this.showModal(
            'Restaurar Dados',
            'Tem certeza que deseja restaurar os dados iniciais? Todos os dados atuais serão perdidos.',
            () => {
                dataManager.reset();
            }
        );
    },
    
    async handleExportCSV() {
        try {
            let csvContent = "data:text/csv;charset=utf-8,";
            
            // Cabeçalho
            csvContent += "Produto;Entrada;Saída;Mínimo;Desejável;Atual;Status;Custo Total;Faturamento;Lucro\n";
            
            // Dados
            state.data.products.forEach(product => {
                const metrics = utils.calculateProductMetrics(product);
                const totalEntradas = product.entradas.reduce((sum, e) => sum + e.qty, 0);
                const totalSaidas = product.saidas.reduce((sum, s) => sum + s.qty, 0);
                
                let status = '';
                if (metrics.status === 'danger') status = 'ALERTA';
                else if (metrics.status === 'warning') status = 'ATENÇÃO';
                else status = 'OK';
                
                const row = [
                    `"${product.name}"`,
                    totalEntradas,
                    totalSaidas,
                    product.min,
                    product.des,
                    metrics.currentStock,
                    status,
                    metrics.totalCost.toFixed(2).replace('.', ','),
                    metrics.totalRevenue.toFixed(2).replace('.', ','),
                    metrics.profit.toFixed(2).replace('.', ',')
                ].join(';');
                
                csvContent += row + "\n";
            });
            
            // Criar link de download
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `estoque_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showToast('Arquivo CSV exportado com sucesso!', 'success');
        } catch (error) {
            this.showToast('Erro ao exportar CSV', 'error');
            console.error(error);
        }
    },
    
    refreshData() {
        dataManager.load();
        this.updateDashboard();
        this.updateCharts();
        this.showToast('Dados atualizados!', 'success');
    },
    
    handleSimulation() {
        const budget = parseFloat(document.getElementById('simulationBudget').value) || 1000;
        const suggestions = dataManager.getPurchaseSuggestions();
        
        let html = `<h4>Simulação com orçamento de ${utils.formatCurrency(budget)}</h4>`;
        
        if (suggestions.suggestions.length === 0) {
            html += '<p class="text-success">Nenhuma compra necessária no momento.</p>';
        } else {
            let totalCost = 0;
            let affordableItems = [];
            
            suggestions.suggestions.forEach(item => {
                if (totalCost + item.totalCost <= budget) {
                    totalCost += item.totalCost;
                    affordableItems.push(item);
                }
            });
            
            if (affordableItems.length > 0) {
                html += '<p class="text-success">Com este orçamento você pode comprar:</p><ul>';
                affordableItems.forEach(item => {
                    html += `<li><strong>${item.product}</strong>: ${item.missing} unidades por ${utils.formatCurrency(item.totalCost)}</li>`;
                });
                html += `</ul><p><strong>Total: ${utils.formatCurrency(totalCost)}</strong></p>`;
                html += `<p>Saldo restante: ${utils.formatCurrency(budget - totalCost)}</p>`;
            } else {
                html += '<p class="text-warning">Orçamento insuficiente para qualquer item da lista.</p>';
            }
        }
        
        document.getElementById('simulationResults').innerHTML = html;
    },
    
    // ============ HANDLERS DE FILTROS ============
    
    handleStockFilter() {
        this.updateStockTable();
    },
    
    filterEntriesByMonth() {
        // Implementar filtro por mês se necessário
        this.updateEntriesTable();
    },
    
    filterOutputsByMonth() {
        // Implementar filtro por mês se necessário
        this.updateOutputsTable();
    },
    
    searchProducts() {
        const searchTerm = document.getElementById('searchProducts').value.toLowerCase();
        const rows = document.querySelectorAll('#productsTableBody tr');
        
        rows.forEach(row => {
            const productName = row.cells[1].textContent.toLowerCase();
            if (productName.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    },
    
    // ============ MODAL E NOTIFICAÇÕES ============
    
    showModal(title, message, onConfirm) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalMessage').textContent = message;
        document.getElementById('confirmationModal').style.display = 'flex';
        
        // Remover listeners anteriores
        const confirmBtn = document.getElementById('modalConfirm');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            this.hideModal();
            if (onConfirm) onConfirm();
        });
    },
    
    hideModal() {
        document.getElementById('confirmationModal').style.display = 'none';
    },
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Remover após 5 segundos
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }
};

// ============ INICIALIZAÇÃO ============
document.addEventListener('DOMContentLoaded', () => {
    // Carregar dados
    dataManager.load();
    
    // Inicializar interface
    uiManager.init();
    
    // CORREÇÃO: Formatar data atual no formato brasileiro para os formulários
    const hoje = new Date();
    const hojeFormatada = hoje.toLocaleDateString('pt-BR');
    const hojeInput = hoje.toISOString().split('T')[0]; // Formato YYYY-MM-DD para input[type=date]
    
    document.getElementById('entryDate').value = hojeInput;
    document.getElementById('outputDate').value = hojeInput;
    
    // Configurar select de ano para gráficos
    const currentYear = new Date().getFullYear();
    const yearSelect = document.getElementById('chartYear');
    if (yearSelect) {
        yearSelect.value = currentYear.toString();
        yearSelect.addEventListener('change', () => {
            uiManager.updateCharts();
        });
    }
    
    console.log('Sistema LORD Inventory inicializado com sucesso!');
});

// ============ FUNÇÕES GLOBAIS ============
window.LORD = {
    version: APP_VERSION,
    data: state,
    utils: utils,
    
    backup() {
        const dataStr = JSON.stringify(state.data);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lord-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        uiManager.showToast('Backup criado com sucesso!', 'success');
    },
    
    async restore(backupData) {
        try {
            const parsed = JSON.parse(backupData);
            if (parsed.version) {
                state.data = parsed;
                dataManager.save();
                uiManager.init();
                uiManager.showToast('Backup restaurado com sucesso!', 'success');
                return true;
            }
        } catch (error) {
            uiManager.showToast('Erro ao restaurar backup: dados inválidos', 'error');
        }
        return false;
    },
    
    getMetrics() {
        return utils.calculateGlobalMetrics();
    }
};
