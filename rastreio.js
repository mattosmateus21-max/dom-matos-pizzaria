// Importações e Inicialização do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-analytics.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAtHbmErdMx_k2lNU7G-uos_VeiV8_fXTQ",
    authDomain: "dom-matos-pizzaria.firebaseapp.com",
    databaseURL: "https://dom-matos-pizzaria-default-rtdb.firebaseio.com",
    projectId: "dom-matos-pizzaria",
    storageBucket: "dom-matos-pizzaria.firebasestorage.app",
    messagingSenderId: "968794744057",
    appId: "1:968794744057:web:51f6dbe8f7f58e6b3d2e28",
    measurementId: "G-X4XQ9XNQ2E"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app); // <--- ESTE ERA O GRANDE DETALHE QUE FALTAVA!

// Pega o ID passado na URL (ex: rastreio.html?id=4829)
const urlParams = new URLSearchParams(window.location.search);
const pedidoId = urlParams.get('id');

if (!pedidoId) {
    alert("Nenhum ID de pedido foi informado!");
    window.location.href = "index.html";
}

document.getElementById('num-pedido').innerText = `Pedido #${pedidoId}`;

// Referência no Realtime Database para este ID específico
const pedidoRef = ref(db, 'pedidos/' + pedidoId);

// Fica ouvindo alterações em tempo real
onValue(pedidoRef, (snapshot) => {
    const pedido = snapshot.val();

    if (!pedido) {
        document.getElementById('status-texto').innerText = "Pedido não encontrado no sistema.";
        return;
    }

    const status = pedido.status || "Recebido";
    document.getElementById('status-texto').innerText = status;

    let barra = document.getElementById('barra-progresso');

    // Atualiza a barra de progresso visual de acordo com o status atualizado pela cozinha
    if (status === "Recebido") {
        barra.style.width = "25%";
        barra.className = "progress-bar progress-bar-striped progress-bar-animated bg-warning text-dark fw-bold";
        barra.innerText = "Recebido / Na Fila";
    } else if (status === "Em preparação") {
        barra.style.width = "50%";
        barra.className = "progress-bar progress-bar-striped progress-bar-animated bg-info text-dark fw-bold";
        barra.innerText = "Em Preparação na Cozinha 🍕";
    } else if (status === "Pronto / Retirada") {
        barra.style.width = "75%";
        barra.className = "progress-bar progress-bar-striped progress-bar-animated bg-primary fw-bold";
        barra.innerText = "Pedido Pronto 📦";
    } else if (status === "Saiu para entrega") {
        barra.style.width = "100%";
        barra.className = "progress-bar bg-success fw-bold";
        barra.innerText = "Saiu para Entrega 🛵";
    }

    // Exibe os detalhes do cliente e itens
    let itensTexto = "";
    if (pedido.itens && Array.isArray(pedido.itens)) {
        itensTexto = pedido.itens.map(i => `<li>${i.nome} (x${i.quantidade}) — R$ ${(i.preco * i.quantidade).toFixed(2)}</li>`).join('');
    }

    document.getElementById('detalhes-pedido').innerHTML = `
        <strong>Cliente:</strong> ${pedido.cliente}<br>
        <strong>Endereço:</strong> ${pedido.endereco}<br>
        <strong>Forma de Pagamento:</strong> ${pedido.pagamento}<br>
        <strong class="mt-2 d-block">Itens do Pedido:</strong>
        <ul class="mb-0 ps-3">${itensTexto}</ul>
        <hr>
        <strong class="text-danger">Total: R$ ${pedido.total.toFixed(2)}</strong>
    `;
});