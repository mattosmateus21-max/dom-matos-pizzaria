// Importações e Inicialização do Firebase
import { db } from './firebase.js';
import { ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-database.js";

const pedidosRef = ref(db, 'pedidos');

// Variáveis globais para controlar o estado da tela
let filtroAtual = 'ativos'; 
let ultimosDadosRecebidos = null; // Guarda os dados do Firebase em cache

// Escuta alterações em tempo real
onValue(pedidosRef, (snapshot) => {
    ultimosDadosRecebidos = snapshot.val(); // Salva os dados na memória
    renderizarPedidos(); // Desenha na tela
});

// Função centralizada que desenha os pedidos baseada na aba selecionada
function renderizarPedidos() {
    const container = document.getElementById('lista-pedidos');
    
    if (!ultimosDadosRecebidos) {
        container.innerHTML = `<div class="col-12 text-center text-muted py-5"><h4>Nenhum pedido no momento.</h4></div>`;
        return;
    }

    container.innerHTML = "";
    let contadorPedidosExibidos = 0;

    Object.keys(ultimosDadosRecebidos).forEach(key => {
        const pedido = ultimosDadosRecebidos[key];
        const status = pedido.status || "Recebido";

        const isConcluido = (status === 'Saiu para entrega' || status === 'Pronto / Retirada');

        // Aplica o filtro das abas
        if (filtroAtual === 'ativos' && isConcluido) return;
        if (filtroAtual === 'historico' && !isConcluido) return;

        contadorPedidosExibidos++;

        let itensHtml = "";
        if (pedido.itens && Array.isArray(pedido.itens)) {
            itensHtml = pedido.itens.map(i => `<li>${i.nome} (x${i.quantidade})</li>`).join('');
        }

        let badgeClass = "bg-warning text-dark";
        if (status === "Em preparação") badgeClass = "bg-info text-dark";
        else if (status === "Pronto / Retirada") badgeClass = "bg-primary";
        else if (status === "Saiu para entrega") badgeClass = "bg-success";

        const cardHtml = `
            <div class="col-md-4 mb-4">
                <div class="card shadow-sm h-100 border-0">
                    <div class="card-header bg-dark text-white d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">Pedido #${pedido.id || key}</h5>
                        <span class="badge ${badgeClass}">${status}</span>
                    </div>
                    <div class="card-body">
                        <h6 class="fw-bold text-danger">${pedido.cliente}</h6>
                        <p class="small text-muted mb-2"><strong>Endereço:</strong> ${pedido.endereco}</p>
                        <p class="small text-muted mb-2"><strong>Pagamento:</strong> ${pedido.pagamento}</p>
                        
                        <hr class="my-2">
                        <p class="small fw-bold mb-1">Itens:</p>
                        <ul class="small ps-3 text-secondary mb-3">
                            ${itensHtml}
                        </ul>
                        <p class="fw-bold text-dark mb-3">Total: R$ ${pedido.total ? pedido.total.toFixed(2) : '0.00'}</p>
                    </div>
                    <div class="card-footer bg-light border-top-0 d-flex flex-column gap-2">
                        <button class="btn btn-sm btn-info w-100 fw-bold" onclick="mudarStatus('${key}', 'Em preparação')">👨‍🍳 Em Preparação</button>
                        <button class="btn btn-sm btn-primary w-100 fw-bold" onclick="mudarStatus('${key}', 'Pronto / Retirada')">📦 Pedido Pronto</button>
                        <button class="btn btn-sm btn-success w-100 fw-bold" onclick="mudarStatus('${key}', 'Saiu para entrega')">🛵 Saiu para Entrega</button>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += cardHtml;
    });

    if (contadorPedidosExibidos === 0) {
        container.innerHTML = `<div class="col-12 text-center text-muted py-5"><h4>Nenhum pedido encontrado nesta aba.</h4></div>`;
    }
}

// Função global para alterar o status no Firebase
window.mudarStatus = function(idPedido, novoStatus) {
    const pedidoRefUnico = ref(db, 'pedidos/' + idPedido);
    update(pedidoRefUnico, { status: novoStatus })
        .catch((error) => {
            console.error("Erro ao atualizar status: ", error);
            alert("Erro ao atualizar status do pedido.");
        });
};

// Função global ligada aos botões de alternar aba
window.mudarFiltro = function(tipo) {
    filtroAtual = tipo;
    
    const btnAtivos = document.getElementById('btnAtivos');
    const btnHistorico = document.getElementById('btnHistorico');

    if (btnAtivos && btnHistorico) {
        // Alterna as classes visuais do Bootstrap para destacar o botão ativo
        if (tipo === 'ativos') {
            btnAtivos.className = "btn btn-dark active";
            btnHistorico.className = "btn btn-outline-dark";
        } else {
            btnAtivos.className = "btn btn-outline-dark";
            btnHistorico.className = "btn btn-dark active";
        }
    }
    
    // Força a atualização imediata dos cards na tela usando os dados armazenados
    renderizarPedidos();
};