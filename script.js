// Importações e Inicialização do Firebase
import { db } from './firebase.js';
import { ref, set } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-database.js";

// Registra o Service Worker para permitir que a aplicação funcione com cache e offline.
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(function(registration) {
        console.log('Service Worker registrado com sucesso:', registration);
    }).catch(function(error) {
        console.log('Falha ao registrar o Service Worker:', error);
    });
} else {
    console.log('Service Workers não são disponíveis nesse navegador.');
}

// Lê os parâmetros enviados na URL para recuperar o nome e o preço do produto selecionado.
function parseQuery() {
    const params = new URLSearchParams(location.search);
    return {
        nome: params.get('nome') || '',
        preco: params.get('preco') ? parseFloat(params.get('preco')) : 0
    };
}

// Busca o carrinho salvo no armazenamento local do navegador.
function getCart() {
    try {
        return JSON.parse(localStorage.getItem('cart') || '[]');
    } catch (e) {
        return [];
    }
}

// Salva o estado atual do carrinho no armazenamento local.
function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Adiciona um item ao carrinho ou aumenta a quantidade caso ele já exista.
function addToCart(item) {
    const cart = getCart();
    const existing = cart.find(i => i.nome === item.nome);
    if (existing) {
        existing.quantidade += item.quantidade;
    } else {
        cart.push(item);
    }
    saveCart(cart);
}

// Remove todos os itens do carrinho do armazenamento local.
function clearCart() {
    localStorage.removeItem('cart');
}

// Calcula o valor total do carrinho com base no preço e na quantidade de cada item.
function getCartTotal(cart) {
    return cart.reduce((s, it) => s + (it.preco * it.quantidade), 0);
}

// Formata um valor numérico para o padrão monetário brasileiro.
function formatPrice(num) {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Renderiza a tabela do carrinho na página de checkout com os itens e o total.
function renderCartTable(tableBodyId, totalId) {
    const cart = getCart();
    const tbody = document.getElementById(tableBodyId);
    const totalEl = document.getElementById(totalId);
    if (!tbody) return;
    tbody.innerHTML = '';
    cart.forEach(item => {
        const tr = document.createElement('tr');
        const description = item.size || item.crust || item.note ?
            `<small>${item.size ? item.size + ' • ' : ''}${item.crust ? 'Borda ' + item.crust + ' • ' : ''}${item.note ? item.note : ''}</small>` : '';
        tr.innerHTML = `<td>${item.nome}${description ? `<br>${description}` : ''}</td><td>${item.quantidade}</td><td>R$ ${formatPrice(item.preco)}</td><td>R$ ${formatPrice(item.preco * item.quantidade)}</td>`;
        tbody.appendChild(tr);
    });
    if (totalEl) totalEl.textContent = `R$ ${formatPrice(getCartTotal(cart))}`;
}

// Redireciona para a página do carrinho.
function goToCart() {
    location.href = 'cart.html';
}

// Salva as informações de pagamento no armazenamento local.
function savePaymentInfo(info) {
    try {
        localStorage.setItem('paymentInfo', JSON.stringify(info));
    } catch (e) {
        console.error('Falha ao salvar paymentInfo', e);
    }
}

// Recupera as informações de pagamento previamente salvas.
function getPaymentInfo() {
    try {
        return JSON.parse(localStorage.getItem('paymentInfo') || 'null');
    } catch (e) {
        return null;
    }
}

// Salva o produto selecionado para exibição na página de checkout.
function saveSelectedProduct(product, price, image, size, crust, note) {
    const description = `${size || 'Tamanho não selecionado'} • ${crust ? 'Borda ' + crust : 'Sem borda'}${note ? ' • ' + note : ''}`;
    localStorage.setItem('selectedProduct', JSON.stringify({
        product: product || 'Pizza',
        price: price || '',
        image: image || '',
        size: size || '',
        crust: crust || '',
        note: note || '',
        description
    }));
}

// Recupera o produto selecionado armazenado no navegador.
function getSelectedProduct() {
    try {
        return JSON.parse(localStorage.getItem('selectedProduct') || 'null');
    } catch (e) {
        return null;
    }
}

// Constrói a URL completa de uma imagem a partir do nome ou caminho informado.
function getImageUrl(imageFile) {
    if (!imageFile) return '';
    if (imageFile.startsWith('http://') || imageFile.startsWith('https://')) {
        return imageFile;
    }
    const baseUrl = window.location.origin && window.location.origin !== 'null'
        ? window.location.origin
        : window.location.href.replace(/\/[^/]*$/, '/');
    const normalized = imageFile.startsWith('/') ? imageFile.slice(1) : imageFile;
    return `${baseUrl}${baseUrl.endsWith('/') ? '' : '/'}${normalized}`;
}

// Retorna uma imagem padrão para produtos que não possuem imagem definida.
function getProductImageFallback(productName) {
    const map = {
        'Calabresa': 'pizzacala.webp',
        'Portuguesa': 'pizzaportuguesa.webp',
        'Moda da Casa': 'pizzamodacasa.webp',
        'Frango com Catupiry': 'pizzafrangocatupiry.webp',
        'Calabresa Especial': 'pizzacalabresaespecial.webp',
        'Fanta': 'imagens/fanta.webp',
        'Coca': 'imagens/coca.webp'
    };
    return map[productName] || 'pizzacala.webp';
}

// Resolve os dados de um produto a partir de um elemento da interface.
function resolveProductInfo(element, fallbackProduct) {
    const product = element.getAttribute('data-product') || fallbackProduct || 'Produto';
    const basePrice = element.getAttribute('data-price') || '';
    let image = (element.getAttribute('data-image') || '').trim();
    const itemContainer = element.closest('.carousel-item');
    const sizeSelect = itemContainer?.querySelector('.pizza-size');
    const crustSelect = itemContainer?.querySelector('.pizza-crust');
    const noteInput = itemContainer?.querySelector('.pizza-note');

    const size = sizeSelect?.value || 'Pequena';
    const sizePrice = sizeSelect?.selectedOptions[0]?.getAttribute('data-price') || basePrice;
    const crust = crustSelect?.value || '';
    const crustExtra = parseFloat(crustSelect?.selectedOptions[0]?.getAttribute('data-extra') || '0');
    const note = noteInput?.value.trim() || '';

    let numericPrice = parseFloat(sizePrice || '0');
    if (!isNaN(crustExtra)) {
        numericPrice += crustExtra;
    }

    if (!image) {
        const imgEl = itemContainer?.querySelector('img');
        image = imgEl ? (imgEl.getAttribute('src') || '') : '';
    }

    if (!image) {
        image = getProductImageFallback(product);
    }

    const displayName = `${product} (${size}${crust ? `, borda ${crust}` : ''}${note ? `, ${note}` : ''})`;

    return {
        product: displayName,
        price: numericPrice.toFixed(2),
        image,
        size,
        crust,
        note
    };
}

// Adiciona o bloco de endereço à mensagem do WhatsApp.
function appendAddressInfo(lines, addressInfo) {
    if (!addressInfo) return;

    if (addressInfo.mesa) {
        lines.push('', '📍 Local:');
        lines.push(`- Mesa: ${addressInfo.mesa}`);
        return;
    }

    lines.push('', '📍 Endereço:');
    lines.push(`- Rua: ${addressInfo.rua}`);
    lines.push(`- Número: ${addressInfo.numero}`);
    lines.push(`- Bairro: ${addressInfo.bairro}`);
}

// Adiciona a forma de pagamento à mensagem do WhatsApp.
function appendPaymentMethod(lines, paymentMethod) {
    if (!paymentMethod) return;

    lines.push('', `💳 Forma de pagamento: ${paymentMethod}`);
}

// Codifica o texto da mensagem para ser usado corretamente na URL do WhatsApp.
function encodeWhatsappText(message) {
    return encodeURIComponent(message).replace(/%20/g, '+');
}

// Monta a mensagem que será enviada ao WhatsApp para um produto isolado.
function buildWhatsAppMessage(productName, price, addressInfo, paymentMethod, imageFile, customerName) {
    const imageUrl = getImageUrl(imageFile);
    const greeting = customerName ? `Cliente: ${customerName}! 👋` : 'Cliente! 👋';
    const lines = [
        greeting,
        '',
        '📋 Pedido:',
        `- Produto: ${productName}`
    ];

    if (price) {
        lines.push(`- Valor: R$ ${price}`);
    }

    appendAddressInfo(lines, addressInfo);
    appendPaymentMethod(lines, paymentMethod);

    if (imageUrl) {
        lines.push('', `🖼️ Imagem do produto: ${imageUrl}`);
    }

    return lines.join('\n');
}

// Monta a mensagem que será enviada ao WhatsApp com base no carrinho completo.
function buildWhatsAppMessageFromCart(cart, addressInfo, paymentMethod, customerName) {
    const greeting = customerName ? `Cliente: ${customerName}! 👋` : 'Cliente! 👋';
    const lines = [
        greeting,
        '',
        '📋 Pedido:'
    ];

    cart.forEach(item => {
        const subtotal = formatPrice(item.preco * item.quantidade);
        lines.push(`- ${item.nome} x${item.quantidade} — R$ ${subtotal}`);
    });

    lines.push('', `Total: R$ ${formatPrice(getCartTotal(cart))}`);
    appendAddressInfo(lines, addressInfo);
    appendPaymentMethod(lines, paymentMethod);

    return lines.join('\n');
}

// Remove o produto selecionado do armazenamento local.
function clearSelectedProduct() {
    localStorage.removeItem('selectedProduct');
}

function showProductOptions(itemContainer) {
    if (!itemContainer) return;
    hideAllProductOptions();
    const options = itemContainer.querySelector('.product-options');
    if (options) {
        options.classList.remove('hidden');
    }
}

function hideAllProductOptions() {
    document.querySelectorAll('.product-options').forEach(function(options) {
        options.classList.add('hidden');
    });
}

function isInsideProductCard(target) {
    return Boolean(target.closest('.carousel-item'));
}

function validateProductOptions(itemContainer) {
    if (!itemContainer) return false;
    const sizeValue = itemContainer.querySelector('.pizza-size')?.value || '';
    const crustValue = itemContainer.querySelector('.pizza-crust')?.value || '';
    return Boolean(sizeValue && crustValue);
}

let pendingPizzaOrder = null;

function openDrinkComplement(pizza, action) {
    const dialog = document.getElementById('drinkComplementDialog');
    if (!dialog) {
        completePizzaOrder(pizza, action, []);
        return;
    }

    pendingPizzaOrder = { pizza, action };
    dialog.querySelectorAll('input[name="complementDrink"]').forEach(function(input) {
        input.checked = false;
    });
    dialog.showModal();
}

function completePizzaOrder(pizza, action, drinks) {
    if (action === 'checkout' && drinks.length === 0) {
        saveSelectedProduct(pizza.product, pizza.price, pizza.image, pizza.size, pizza.crust, pizza.note);
        window.location.href = 'endepagam.html';
        return;
    }

    const pizzaItem = {
        nome: pizza.product,
        preco: parseFloat(pizza.price || '0'),
        quantidade: 1,
        image: pizza.image,
        size: pizza.size,
        crust: pizza.crust,
        note: pizza.note
    };
    addToCart(pizzaItem);
    drinks.forEach(function(drink) {
        addToCart({ nome: drink.nome, preco: drink.preco, quantidade: 1, image: drink.image });
    });

    if (action === 'checkout') {
        clearSelectedProduct();
        window.location.href = 'endepagam.html';
        return;
    }

    updateCartSummary();
    showToast(`${pizza.product} adicionado ao carrinho.`);
}

function initDrinkComplement() {
    const dialog = document.getElementById('drinkComplementDialog');
    const confirmButton = document.getElementById('confirmDrinkComplement');
    const skipButton = document.getElementById('skipDrinkComplement');
    if (!dialog || !confirmButton || !skipButton) return;

    const finish = function(includeDrinks) {
        if (!pendingPizzaOrder) return;
        const drinks = includeDrinks
            ? Array.from(dialog.querySelectorAll('input[name="complementDrink"]:checked')).map(function(input) {
                return {
                    nome: input.value,
                    preco: parseFloat(input.dataset.price),
                    image: input.dataset.image
                };
            })
            : [];
        const pendingOrder = pendingPizzaOrder;
        pendingPizzaOrder = null;
        dialog.close();
        completePizzaOrder(pendingOrder.pizza, pendingOrder.action, drinks);
    };

    confirmButton.addEventListener('click', function() {
        finish(true);
    });
    skipButton.addEventListener('click', function() {
        finish(false);
    });
    dialog.addEventListener('cancel', function(event) {
        event.preventDefault();
        finish(false);
    });
}

// Inicializa os links de seleção de produto para salvar o pedido na página de checkout.
function initProductSelection() {
    document.querySelectorAll('.select-order').forEach(function(link) {
        link.addEventListener('click', function(event) {
            const itemContainer = link.closest('.carousel-item');
            const options = itemContainer?.querySelector('.product-options');
            if (options && options.classList.contains('hidden')) {
                event.preventDefault();
                showProductOptions(itemContainer);
                return;
            }

            if (options && !validateProductOptions(itemContainer)) {
                event.preventDefault();
                showProductOptions(itemContainer);
                showToast('Selecione o tamanho e a borda antes de continuar.');
                return;
            }

            event.preventDefault();
            const productInfo = resolveProductInfo(link, 'Pizza');
            if (itemContainer?.querySelector('.pizza-size')) {
                openDrinkComplement(productInfo, 'checkout');
                return;
            }

            saveSelectedProduct(productInfo.product, productInfo.price, productInfo.image, productInfo.size, productInfo.crust, productInfo.note);
            window.location.href = 'endepagam.html';
        });
    });
}

// Inicializa os botões de adicionar ao carrinho na interface principal.
function initAddToCartButtons() {
    document.querySelectorAll('.add-to-cart').forEach(function(button) {
        button.addEventListener('click', function(event) {
            const itemContainer = button.closest('.carousel-item');
            const options = itemContainer?.querySelector('.product-options');
            if (options && options.classList.contains('hidden')) {
                event.preventDefault();
                showProductOptions(itemContainer);
                return;
            }

            if (options && !validateProductOptions(itemContainer)) {
                event.preventDefault();
                showProductOptions(itemContainer);
                showToast('Selecione o tamanho e a borda antes de adicionar ao carrinho.');
                return;
            }

            const productInfo = resolveProductInfo(button, 'Produto');
            if (itemContainer?.querySelector('.pizza-size')) {
                openDrinkComplement(productInfo, 'cart');
                return;
            }

            const numericPrice = parseFloat(productInfo.price || '0');
            addToCart({ nome: productInfo.product, preco: numericPrice, quantidade: 1, image: productInfo.image, size: productInfo.size, crust: productInfo.crust, note: productInfo.note });
            updateCartSummary();
            showToast(`${productInfo.product} adicionado ao carrinho.`);
        });
    });
}

// Esconde as opções de pizza caso o clique aconteça fora de qualquer card.
document.addEventListener('click', function(event) {
    if (!isInsideProductCard(event.target)) {
        hideAllProductOptions();
    }
});

// Atualiza o resumo do carrinho exibido na interface.
function updateCartSummary() {
    const cart = getCart();
    const cartSummaryText = document.getElementById('cartSummaryText');
    if (!cartSummaryText) return;
    if (cart.length === 0) {
        cartSummaryText.textContent = 'Nenhum item no carrinho.';
        return;
    }
    const totalItems = cart.reduce((sum, item) => sum + item.quantidade, 0);
    const totalPrice = formatPrice(getCartTotal(cart));
    cartSummaryText.textContent = `${totalItems} item(s) no carrinho — Total: R$ ${totalPrice}`;
}

// Inicializa o botão que leva para a página do carrinho.
function initCartButton() {
    const viewCartButton = document.getElementById('viewCartButton');
    if (!viewCartButton) return;
    viewCartButton.addEventListener('click', function() {
        location.href = 'endepagam.html';
    });
}

// Inicializa os botões de envio direto para o WhatsApp.
function initWhatsAppButtons() {
    document.querySelectorAll('.whats').forEach(function(button) {
        button.addEventListener('click', function() {
            const product = button.getAttribute('data-product') || 'pizza';
            const price = button.getAttribute('data-price') || '';
            const image = button.getAttribute('data-image') || '';
            const message = buildWhatsAppMessage(product, price, null, null, image);
            const url = `https://wa.me/5587991683831?text=${encodeWhatsappText(message)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        });
    });
}

// Exibe uma mensagem temporária na tela para feedback do usuário.
function showToast(message) {
    let toast = document.getElementById('toastNotification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toastNotification';
        toast.className = 'toast-notification';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    if (toast.hideTimeout) {
        window.clearTimeout(toast.hideTimeout);
    }
    toast.hideTimeout = window.setTimeout(function() {
        toast.classList.remove('show');
    }, 3200);
}

// Atualiza o preview do pedido que aparece na página de checkout.
function updateOrderPreview(text) {
    const preview = document.getElementById('orderPreview');
    const previewText = document.getElementById('previewText');
    if (!preview || !previewText) return;
    previewText.textContent = text;
    preview.classList.remove('hidden');
}

// Marca visualmente a opção de pagamento selecionada pelo usuário.
function updatePaymentSelection() {
    document.querySelectorAll('.payment-option').forEach(function(option) {
        const input = option.querySelector('input');
        if (!input) return;
        option.classList.toggle('selected', input.checked);
        option.addEventListener('click', function() {
            input.checked = true;
            document.querySelectorAll('.payment-option').forEach(function(other) {
                other.classList.toggle('selected', other === option);
            });
        });
    });
}

// Controla a exibição do formulário conforme a opção de entrega escolhida.
function initDeliverySelection() {
    const deliveryOptions = document.querySelectorAll('input[name="deliveryOption"]');
    const formCard = document.getElementById('checkoutFormCard');
    const formTitle = document.getElementById('formTitle');
    const addressFields = document.getElementById('addressFields');
    const ruaInput = document.getElementById('rua');
    const numeroInput = document.getElementById('numero');
    const bairroInput = document.getElementById('bairro');
    const mesaInput = document.getElementById('mesa');

    if (!deliveryOptions.length || !formCard) return;

    const toggleForm = () => {
        const selectedOption = document.querySelector('input[name="deliveryOption"]:checked')?.value || 'delivery';
        const isDelivery = selectedOption === 'delivery';
        const isConsumir = selectedOption === 'consumir';

        formCard.classList.remove('hidden');
        if (formTitle) {
            formTitle.textContent = isDelivery ? 'Dados para Delivery' : selectedOption === 'retirada' ? 'Dados para Retirada' : 'Dados para Consumir no local';
        }

        if (addressFields) {
            addressFields.classList.toggle('hidden', !isDelivery);
        }

        if (mesaInput) {
            const mesaField = mesaInput.closest('.field-row');
            if (mesaField) {
                mesaField.classList.toggle('hidden', !isConsumir);
            }
            mesaInput.required = isConsumir;
        }

        [ruaInput, numeroInput, bairroInput].forEach(function(input) {
            if (!input) return;
            const parentField = input.closest('.field-row');
            if (parentField) {
                parentField.classList.toggle('hidden', !isDelivery);
            }
            input.required = isDelivery;
        });
    };

    deliveryOptions.forEach(function(input) {
        input.addEventListener('change', toggleForm);
    });

    toggleForm();
}

// Inicializa a página de checkout, exibindo o resumo do pedido ou o carrinho conforme o estado.
function initCheckoutPage() {
    const selectedProduct = getSelectedProduct();
    const cart = getCart();
    const summaryCard = document.getElementById('checkoutSummaryCard');
    const cartSection = document.getElementById('cartSection');
    const selectedImage = document.getElementById('selectedProductImage');
    const selectedName = document.getElementById('selectedProductName');
    const selectedDesc = document.getElementById('selectedProductDesc');
    const selectedPrice = document.getElementById('selectedProductPrice');
    const noProductMessage = document.getElementById('noProductMessage');
    const form = document.getElementById('checkoutForm');

    if (cart.length > 0) {
        if (summaryCard) {
            summaryCard.classList.add('hidden');
        }
        if (cartSection) {
            cartSection.classList.remove('hidden');
            renderCartTable('cartTableBody', 'cartTotal');
        }
        if (noProductMessage) {
            noProductMessage.classList.add('hidden');
        }
        const removeButton = document.getElementById('removeProductButton');
        if (removeButton) {
            removeButton.classList.add('hidden');
        }
    } else if (selectedProduct && selectedProduct.product) {
        if (summaryCard) {
            summaryCard.classList.remove('hidden');
        }
        if (cartSection) {
            cartSection.classList.add('hidden');
        }
        const imageSrc = selectedProduct.image || getProductImageFallback(selectedProduct.product);
        if (selectedImage) {
            selectedImage.src = imageSrc;
            selectedImage.alt = selectedProduct.product;
        }
        if (selectedName) {
            selectedName.textContent = selectedProduct.product;
        }
        if (selectedDesc) {
            selectedDesc.textContent = selectedProduct.description || 'Seu pedido está quase pronto. Complete o endereço e envie pelo WhatsApp.';
        }
        if (selectedPrice) {
            selectedPrice.textContent = selectedProduct.price ? `Valor: R$ ${selectedProduct.price}` : '';
        }
        if (noProductMessage) {
            noProductMessage.classList.add('hidden');
        }
        const removeButton = document.getElementById('removeProductButton');
        if (removeButton) {
            removeButton.classList.remove('hidden');
        }
    } else {
        if (summaryCard) {
            summaryCard.classList.add('hidden');
        }
        if (cartSection) {
            cartSection.classList.add('hidden');
        }
        if (noProductMessage) {
            noProductMessage.classList.remove('hidden');
        }
    }

    updatePaymentSelection();

    if (form) {
        form.addEventListener('input', function() {
            const nome = document.getElementById('nome').value.trim();
            const sobrenome = document.getElementById('sobrenome').value.trim();
            const rua = document.getElementById('rua').value.trim();
            const numero = document.getElementById('numero').value.trim();
            const bairro = document.getElementById('bairro').value.trim();
            const mesa = document.getElementById('mesa').value.trim();
            const pagamento = document.querySelector('input[name="pagamentos"]:checked')?.value || 'Não informado';
            const deliveryOption = document.querySelector('input[name="deliveryOption"]:checked')?.value || 'delivery';
            const cart = getCart();
            const customerName = [nome, sobrenome].filter(Boolean).join(' ');
            const isDelivery = deliveryOption === 'delivery';
            const isConsumir = deliveryOption === 'consumir';
            const addressText = isDelivery ? `${rua || '...'}, ${numero || '...'}, ${bairro || '...'}` : isConsumir ? `Mesa: ${mesa || '...'}` : 'Retirada no estabelecimento';
            let previewText;

            if (cart.length > 0) {
                const itemsText = cart.map(item => `- ${item.nome} x${item.quantidade} — R$ ${formatPrice(item.preco * item.quantidade)}`).join('\n');
                previewText = `Cliente: ${customerName || 'cliente'}!\nForma de entrega: ${isDelivery ? 'Delivery' : 'Retirada'}\nItens:\n${itemsText}\nTotal: R$ ${formatPrice(getCartTotal(cart))}\nEndereço: ${addressText}\nPagamento: ${pagamento}`;
            } else {
                const product = selectedProduct?.product || 'Nenhum produto selecionado';
                const price = selectedProduct?.price || '';
                previewText = `Cliente: ${customerName || 'cliente'}!\nForma de entrega: ${isDelivery ? 'Delivery' : 'Retirada'}\nProduto: ${product}${price ? `\nValor: R$ ${price}` : ''}\nEndereço: ${addressText}\nPagamento: ${pagamento}`;
            }

            updateOrderPreview(previewText);
        });

        form.addEventListener('submit', async function(event) {
            event.preventDefault();

            const nome = document.getElementById('nome').value.trim();
            const sobrenome = document.getElementById('sobrenome').value.trim();
            const contato = document.getElementById('contato').value.trim();
            const rua = document.getElementById('rua').value.trim();
            const numero = document.getElementById('numero').value.trim();
            const bairro = document.getElementById('bairro').value.trim();
            const mesa = document.getElementById('mesa').value.trim();
            const pagamento = document.querySelector('input[name="pagamentos"]:checked')?.value || 'Não informado';
            const deliveryOption = document.querySelector('input[name="deliveryOption"]:checked')?.value || 'delivery';
            const isDelivery = deliveryOption === 'delivery';
            const isConsumir = deliveryOption === 'consumir';

            if (!nome || !sobrenome || !contato) {
                showToast('Preencha nome, sobrenome e contato para concluir o pedido.');
                return;
            }

            if (isDelivery && (!rua || !numero || !bairro)) {
                showToast('Preencha rua, número e bairro para delivery.');
                return;
            }

            if (isConsumir && !mesa) {
                showToast('Preencha o número da mesa para consumir no local.');
                return;
            }

            const cart = getCart();
            const customerName = [nome, sobrenome].filter(Boolean).join(' ');
            
            // Gera um número de ID único para o pedido (ex: #4829)
            const numeroPedido = Math.floor(1000 + Math.random() * 9000);
            const pedidoId = `#${numeroPedido}`;

            // Prepara os dados do pedido para salvar no banco
            let itensPedido = [];
            let valorTotal = 0;

            if (cart.length > 0) {
                itensPedido = cart;
                valorTotal = getCartTotal(cart);
            } else {
                const product = getSelectedProduct();
                const productName = product?.product || 'Pizza';
                const priceNum = parseFloat(product?.price || '0');
                itensPedido = [{ nome: productName, preco: priceNum, quantidade: 1 }];
                valorTotal = priceNum;
            }

            const dadosNovoPedido = {
                id: pedidoId,
                cliente: customerName,
                entrega: isDelivery ? 'Delivery' : isConsumir ? 'Consumir no local' : 'Retirada',
                endereco: isDelivery ? `Rua: ${rua}, Nº ${numero}, Bairro: ${bairro}` : isConsumir ? `Mesa: ${mesa}` : 'Retirada no estabelecimento',
                mesa: isConsumir ? mesa : null,
                pagamento: pagamento,
                itens: itensPedido,
                total: valorTotal,
                status: "Recebido", // Status inicial para a cozinha
                timestamp: Date.now()
            };

            try {
                // 1. Salva no Firebase Realtime Database
                await set(ref(db, 'pedidos/' + numeroPedido), dadosNovoPedido);

                // 2. Monta a mensagem para o WhatsApp incluindo o ID do pedido e o link de rastreio
                let message;
                const addressInfo = isDelivery ? { rua, numero, bairro } : isConsumir ? { mesa } : null;
                if (cart.length > 0) {
                    message = buildWhatsAppMessageFromCart(cart, addressInfo, pagamento, customerName);
                } else {
                    const product = getSelectedProduct();
                    const productName = product?.product || 'Pizza';
                    const price = product?.price || '';
                    const image = product?.image || '';
                    message = buildWhatsAppMessage(productName, price, addressInfo, pagamento, image, customerName);
                }

                // Adiciona o aviso do ID e do rastreio no texto do WhatsApp
                message += `\n\n📌 *Número do Pedido:* ${pedidoId}`;
                message += `\n🔍 *Acompanhe seu pedido em tempo real:*`;
                message += `\nhttps://dom-matos-pizzaria.web.app/rastreio.html?id=${numeroPedido}`;

                // 3. Limpa os dados salvos localmente
                clearCart();
                clearSelectedProduct();

                // 4. Abre o WhatsApp e redireciona o cliente para a página de rastreio
                const url = `https://wa.me/5587991683831?text=${encodeWhatsappText(message)}`;
                window.open(url, '_blank', 'noopener,noreferrer');
                
                window.location.href = `rastreio.html?id=${numeroPedido}`;

            } catch (error) {
                console.error("Erro ao salvar pedido no Firebase: ", error);
                showToast("Erro ao processar o pedido. Tente novamente.");
            }
        });
    }

    const clearCartButton = document.getElementById('clearCartButton');
    if (clearCartButton) {
        clearCartButton.addEventListener('click', function() {
            clearCart();
            if (cartSection) {
                cartSection.classList.add('hidden');
            }
            if (summaryCard && selectedProduct && selectedProduct.product) {
                summaryCard.classList.remove('hidden');
            }
            if (noProductMessage) {
                noProductMessage.classList.add('hidden');
            }
            showToast('Carrinho limpo.');
        });
    }

    const removeProductButton = document.getElementById('removeProductButton');
    if (removeProductButton) {
        removeProductButton.addEventListener('click', function() {
            clearSelectedProduct();
            location.reload();
        });
    }
}

// Inicializa todos os componentes da página quando o DOM estiver pronto.
document.addEventListener('DOMContentLoaded', function() {
    initDrinkComplement();
    initGuaranaCarousel();
    initProductSelection();
    initAddToCartButtons();
    initCartButton();
    updateCartSummary();
    initWhatsAppButtons();
    initDeliverySelection();
    initCheckoutPage();
});

function initGuaranaCarousel() {
    const sizeSelect = document.getElementById('tamanhoGuarana');
    if (!sizeSelect) return;

    sizeSelect.addEventListener('change', function() {
        mostrarCarrosselGuarana(sizeSelect.value);
    });
}

// Função auxiliar antiga para controlar a exibição do banner do carrinho.
function atualizarInterfaceCarrinho(totalItens) {
    const cartBanner = document.querySelector('.cart-banner');

    if (totalItens === 0) {
        cartBanner.style.display = 'none';
    } else {
        cartBanner.style.display = 'block';
    }
}
function mostrarCarrosselGuarana(opcao) {
    const carouselElement = document.getElementById('bebidasCarousel');
    if (!carouselElement) return;

    carouselElement.classList.remove('d-none');

    const items = carouselElement.querySelectorAll('.carousel-item');
    items.forEach(item => item.classList.remove('active'));

    const itemSelecionado = document.getElementById(`item-${opcao}`);
    const itemIndex = Array.from(items).indexOf(itemSelecionado);
    if (itemIndex < 0) return;

    itemSelecionado.classList.add('active');
    const bsCarousel = bootstrap.Carousel.getOrCreateInstance(carouselElement);
    bsCarousel.to(itemIndex);

}