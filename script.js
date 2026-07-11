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
        tr.innerHTML = `<td>${item.nome}</td><td>${item.quantidade}</td><td>R$ ${formatPrice(item.preco)}</td><td>R$ ${formatPrice(item.preco * item.quantidade)}</td>`;
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
function saveSelectedProduct(product, price, image) {
    localStorage.setItem('selectedProduct', JSON.stringify({
        product: product || 'Pizza',
        price: price || '',
        image: image || ''
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
    const price = element.getAttribute('data-price') || '';
    let image = (element.getAttribute('data-image') || '').trim();

    if (!image) {
        const imgEl = element.closest('.carousel-item')?.querySelector('img');
        image = imgEl ? (imgEl.getAttribute('src') || '') : '';
    }

    if (!image) {
        image = getProductImageFallback(product);
    }

    return { product, price, image };
}

// Adiciona o bloco de endereço à mensagem do WhatsApp.
function appendAddressInfo(lines, addressInfo) {
    if (!addressInfo) return;

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

// Inicializa os links de seleção de produto para salvar o pedido na página de checkout.
function initProductSelection() {
    document.querySelectorAll('.select-order').forEach(function(link) {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            const { product, price, image } = resolveProductInfo(link, 'Pizza');
            saveSelectedProduct(product, price, image);
            window.location.href = 'endepagam.html';
        });
    });
}

// Inicializa os botões de adicionar ao carrinho na interface principal.
function initAddToCartButtons() {
    document.querySelectorAll('.add-to-cart').forEach(function(button) {
        button.addEventListener('click', function() {
            const { product, price, image } = resolveProductInfo(button, 'Produto');
            const numericPrice = parseFloat(price || '0');
            addToCart({ nome: product, preco: numericPrice, quantidade: 1, image });
            updateCartSummary();
            showToast(`${product} adicionado ao carrinho.`);
        });
    });
}

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
            const pagamento = document.querySelector('input[name="pagamentos"]:checked')?.value || 'Não informado';
            const cart = getCart();
            const customerName = [nome, sobrenome].filter(Boolean).join(' ');
            let previewText;

            if (cart.length > 0) {
                const itemsText = cart.map(item => `- ${item.nome} x${item.quantidade} — R$ ${formatPrice(item.preco * item.quantidade)}`).join('\n');
                previewText = `Cliente: ${customerName || 'cliente'}!\nItens:\n${itemsText}\nTotal: R$ ${formatPrice(getCartTotal(cart))}\nEndereço: ${rua || '...'}, ${numero || '...'}, ${bairro || '...'}\nPagamento: ${pagamento}`;
            } else {
                const product = selectedProduct?.product || 'Nenhum produto selecionado';
                const price = selectedProduct?.price || '';
                previewText = `Cliente: ${customerName || 'cliente'}!\nProduto: ${product}${price ? `\nValor: R$ ${price}` : ''}\nEndereço: ${rua || '...'}, ${numero || '...'}, ${bairro || '...'}\nPagamento: ${pagamento}`;
            }

            updateOrderPreview(previewText);
        });

        form.addEventListener('submit', function(event) {
            event.preventDefault();

            const nome = document.getElementById('nome').value.trim();
            const sobrenome = document.getElementById('sobrenome').value.trim();
            const rua = document.getElementById('rua').value.trim();
            const numero = document.getElementById('numero').value.trim();
            const bairro = document.getElementById('bairro').value.trim();
            const pagamento = document.querySelector('input[name="pagamentos"]:checked')?.value || 'Não informado';

            if (!nome || !sobrenome || !rua || !numero || !bairro) {
                showToast('Preencha nome, sobrenome, rua, número e bairro para concluir o pedido.');
                return;
            }

            const cart = getCart();
            const customerName = [nome, sobrenome].filter(Boolean).join(' ');
            let message;

            if (cart.length > 0) {
                message = buildWhatsAppMessageFromCart(cart, { rua, numero, bairro }, pagamento, customerName);
            } else {
                const product = getSelectedProduct();
                const productName = product?.product || 'Pizza';
                const price = product?.price || '';
                const image = product?.image || '';
                message = buildWhatsAppMessage(productName, price, { rua, numero, bairro }, pagamento, image, customerName);
            }

            const url = `https://wa.me/5587991683831?text=${encodeWhatsappText(message)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
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
    initProductSelection();
    initAddToCartButtons();
    initCartButton();
    updateCartSummary();
    initWhatsAppButtons();
    initCheckoutPage();
});

// Função auxiliar antiga para controlar a exibição do banner do carrinho.
function atualizarInterfaceCarrinho(totalItens) {
    const cartBanner = document.querySelector('.cart-banner');

    if (totalItens === 0) {
        cartBanner.style.display = 'none';
    } else {
        cartBanner.style.display = 'block';
    }
}