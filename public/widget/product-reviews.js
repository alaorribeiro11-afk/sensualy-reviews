(function () {
  'use strict';

  var API_BASE = window.SensualyReviews ? window.SensualyReviews.apiBase : '';
  var PRODUCT_ID = window.SensualyReviews ? window.SensualyReviews.productId : '';
  var CONTAINER_ID = window.SensualyReviews ? (window.SensualyReviews.containerId || 'sensualy-reviews-widget') : 'sensualy-reviews-widget';

  var currentPage = 1;
  var totalReviews = 0;
  var LIMIT = 5;

  var styles = `
    #sensualy-reviews-widget * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #sensualy-reviews-widget { max-width: 900px; margin: 40px auto; padding: 0 16px; color: #1a1a2e; }
    .sr-section-title { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 24px; border-bottom: 2px solid #e91e8c; padding-bottom: 10px; }
    .sr-summary { display: flex; align-items: center; gap: 32px; background: #fff0f7; border-radius: 16px; padding: 24px 32px; margin-bottom: 32px; flex-wrap: wrap; }
    .sr-score-big { font-size: 64px; font-weight: 900; color: #e91e8c; line-height: 1; }
    .sr-stars-display { display: flex; gap: 4px; margin: 6px 0; }
    .sr-star { font-size: 22px; }
    .sr-star.filled { color: #f4a800; }
    .sr-star.empty { color: #ddd; }
    .sr-total-label { font-size: 13px; color: #888; margin-top: 4px; }
    .sr-breakdown { flex: 1; min-width: 160px; }
    .sr-bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 13px; }
    .sr-bar-label { width: 14px; text-align: right; color: #555; }
    .sr-bar-track { flex: 1; height: 8px; background: #f0d0e6; border-radius: 999px; overflow: hidden; }
    .sr-bar-fill { height: 100%; background: #e91e8c; border-radius: 999px; transition: width 0.5s; }
    .sr-bar-count { width: 20px; color: #888; }
    .sr-form-card { background: #fff; border: 1px solid #f0d0e6; border-radius: 16px; padding: 28px; margin-bottom: 32px; box-shadow: 0 2px 12px rgba(233,30,140,0.07); }
    .sr-form-title { font-size: 17px; font-weight: 700; color: #1a1a2e; margin-bottom: 20px; }
    .sr-field { margin-bottom: 16px; }
    .sr-label { display: block; font-size: 13px; font-weight: 600; color: #555; margin-bottom: 6px; }
    .sr-input, .sr-textarea { width: 100%; padding: 10px 14px; border: 1.5px solid #e0c0d8; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s; }
    .sr-input:focus, .sr-textarea:focus { border-color: #e91e8c; }
    .sr-textarea { resize: vertical; min-height: 90px; }
    .sr-stars-input { display: flex; gap: 6px; margin-top: 4px; cursor: pointer; }
    .sr-star-input { font-size: 30px; color: #ddd; transition: color 0.15s; cursor: pointer; user-select: none; }
    .sr-star-input.active { color: #f4a800; }
    .sr-photo-label { display: flex; align-items: center; gap: 10px; border: 1.5px dashed #e0c0d8; border-radius: 8px; padding: 12px 16px; cursor: pointer; background: #fff8fc; font-size: 13px; color: #888; transition: border-color 0.2s; }
    .sr-photo-label:hover { border-color: #e91e8c; color: #e91e8c; }
    .sr-photo-icon { font-size: 20px; }
    .sr-photo-preview { max-width: 100px; max-height: 100px; border-radius: 8px; margin-top: 8px; display: none; }
    .sr-submit-btn { width: 100%; padding: 13px; background: #e91e8c; color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
    .sr-submit-btn:hover { background: #c0156f; }
    .sr-submit-btn:disabled { background: #ccc; cursor: not-allowed; }
    .sr-msg { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; display: none; }
    .sr-msg.success { background: #e6f9ee; color: #1a7f3c; border: 1px solid #a8ddb8; }
    .sr-msg.error { background: #fdeaea; color: #c0392b; border: 1px solid #f5b7b1; }
    .sr-reviews-list { display: flex; flex-direction: column; gap: 16px; }
    .sr-review-card { background: #fff; border: 1px solid #f0d0e6; border-radius: 14px; padding: 20px 24px; box-shadow: 0 1px 6px rgba(233,30,140,0.05); }
    .sr-review-header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
    .sr-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #e91e8c, #f472b6); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 16px; flex-shrink: 0; }
    .sr-review-meta { flex: 1; }
    .sr-review-author { font-weight: 700; font-size: 15px; color: #1a1a2e; }
    .sr-review-date { font-size: 12px; color: #aaa; margin-top: 2px; }
    .sr-review-stars { display: flex; gap: 2px; }
    .sr-review-text { font-size: 14px; color: #444; line-height: 1.6; margin-bottom: 12px; }
    .sr-review-photo { max-width: 180px; max-height: 180px; border-radius: 10px; object-fit: cover; cursor: pointer; border: 1px solid #f0d0e6; }
    .sr-pagination { display: flex; justify-content: center; gap: 8px; margin-top: 24px; flex-wrap: wrap; }
    .sr-page-btn { padding: 8px 16px; border: 1.5px solid #e91e8c; border-radius: 8px; background: #fff; color: #e91e8c; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s; }
    .sr-page-btn:hover, .sr-page-btn.active { background: #e91e8c; color: #fff; }
    .sr-lightbox { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 99999; justify-content: center; align-items: center; }
    .sr-lightbox.open { display: flex; }
    .sr-lightbox img { max-width: 90vw; max-height: 90vh; border-radius: 12px; }
    .sr-lightbox-close { position: absolute; top: 20px; right: 28px; color: #fff; font-size: 36px; cursor: pointer; line-height: 1; }
    .sr-empty { text-align: center; padding: 32px; color: #aaa; font-size: 15px; }
    @media (max-width: 600px) {
      .sr-summary { padding: 16px; gap: 16px; }
      .sr-score-big { font-size: 48px; }
      .sr-form-card { padding: 18px; }
    }
  `;

  function injectStyles() {
    if (document.getElementById('sr-styles')) return;
    var s = document.createElement('style');
    s.id = 'sr-styles';
    s.textContent = styles;
    document.head.appendChild(s);
  }

  function starsHTML(rating, cls) {
    var html = '';
    for (var i = 1; i <= 5; i++) {
      html += '<span class="sr-star ' + (i <= rating ? 'filled' : 'empty') + '">★</span>';
    }
    return html;
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function renderSummary(stats) {
    var avg = stats.average || 0;
    var total = stats.total || 0;
    var breakdown = stats.breakdown || {};

    var barsHTML = '';
    for (var i = 5; i >= 1; i--) {
      var count = breakdown[i] || 0;
      var pct = total > 0 ? Math.round((count / total) * 100) : 0;
      barsHTML += '<div class="sr-bar-row">' +
        '<span class="sr-bar-label">' + i + '</span>' +
        '<span class="sr-star filled" style="font-size:13px">★</span>' +
        '<div class="sr-bar-track"><div class="sr-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="sr-bar-count">' + count + '</span>' +
        '</div>';
    }

    return '<div class="sr-summary">' +
      '<div style="text-align:center">' +
        '<div class="sr-score-big">' + (avg > 0 ? avg.toFixed(1) : '—') + '</div>' +
        '<div class="sr-stars-display">' + starsHTML(Math.round(avg)) + '</div>' +
        '<div class="sr-total-label">' + total + ' avaliação' + (total !== 1 ? 'ões' : '') + '</div>' +
      '</div>' +
      '<div class="sr-breakdown">' + barsHTML + '</div>' +
    '</div>';
  }

  function renderForm() {
    return '<div class="sr-form-card">' +
      '<div class="sr-form-title">✍️ Deixe sua avaliação</div>' +
      '<div class="sr-msg" id="sr-form-msg"></div>' +
      '<div class="sr-field">' +
        '<label class="sr-label" for="sr-author">Seu nome *</label>' +
        '<input class="sr-input" id="sr-author" type="text" placeholder="Ex: Maria S." maxlength="80" />' +
      '</div>' +
      '<div class="sr-field">' +
        '<label class="sr-label">Nota *</label>' +
        '<div class="sr-stars-input" id="sr-star-input">' +
          '<span class="sr-star-input" data-v="1">★</span>' +
          '<span class="sr-star-input" data-v="2">★</span>' +
          '<span class="sr-star-input" data-v="3">★</span>' +
          '<span class="sr-star-input" data-v="4">★</span>' +
          '<span class="sr-star-input" data-v="5">★</span>' +
        '</div>' +
      '</div>' +
      '<div class="sr-field">' +
        '<label class="sr-label" for="sr-comment">Depoimento *</label>' +
        '<textarea class="sr-textarea" id="sr-comment" placeholder="Conte sua experiência com o produto..." maxlength="1000"></textarea>' +
      '</div>' +
      '<div class="sr-field">' +
        '<label class="sr-label">Foto do produto (opcional)</label>' +
        '<label class="sr-photo-label" for="sr-photo">' +
          '<span class="sr-photo-icon">📷</span>' +
          '<span id="sr-photo-name">Clique para adicionar uma foto</span>' +
        '</label>' +
        '<input type="file" id="sr-photo" accept="image/*" style="display:none" />' +
        '<img id="sr-photo-preview" class="sr-photo-preview" alt="Preview" />' +
      '</div>' +
      '<button class="sr-submit-btn" id="sr-submit-btn">Enviar Avaliação</button>' +
    '</div>';
  }

  function renderReviews(reviews) {
    if (!reviews.length) {
      return '<div class="sr-empty">Nenhuma avaliação ainda. Seja o primeiro! 🌟</div>';
    }
    return reviews.map(function (r) {
      var initial = r.author_name.trim()[0].toUpperCase();
      var photoHTML = r.photo_url ? '<img class="sr-review-photo" src="' + r.photo_url + '" alt="Foto do produto" onclick="window.__srOpenLightbox(\'' + r.photo_url + '\')" />' : '';
      return '<div class="sr-review-card">' +
        '<div class="sr-review-header">' +
          '<div class="sr-avatar">' + initial + '</div>' +
          '<div class="sr-review-meta">' +
            '<div class="sr-review-author">' + escapeHTML(r.author_name) + '</div>' +
            '<div class="sr-review-date">' + formatDate(r.created_at) + '</div>' +
          '</div>' +
          '<div class="sr-review-stars">' + starsHTML(r.rating) + '</div>' +
        '</div>' +
        '<div class="sr-review-text">' + escapeHTML(r.comment) + '</div>' +
        photoHTML +
      '</div>';
    }).join('');
  }

  function renderPagination(page, total) {
    var totalPages = Math.ceil(total / LIMIT);
    if (totalPages <= 1) return '';

    var html = '<div class="sr-pagination">';
    if (page > 1) html += '<button class="sr-page-btn" onclick="window.__srLoadPage(' + (page - 1) + ')">← Anterior</button>';

    var start = Math.max(1, page - 2);
    var end = Math.min(totalPages, page + 2);
    for (var i = start; i <= end; i++) {
      html += '<button class="sr-page-btn' + (i === page ? ' active' : '') + '" onclick="window.__srLoadPage(' + i + ')">' + i + '</button>';
    }

    if (page < totalPages) html += '<button class="sr-page-btn" onclick="window.__srLoadPage(' + (page + 1) + ')">Próxima →</button>';
    html += '</div>';
    return html;
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  }

  function showMsg(text, type) {
    var el = document.getElementById('sr-form-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'sr-msg ' + type;
    el.style.display = 'block';
    if (type === 'success') {
      setTimeout(function () { el.style.display = 'none'; }, 6000);
    }
  }

  function bindForm() {
    var selectedRating = 0;
    var stars = document.querySelectorAll('.sr-star-input');

    stars.forEach(function (star) {
      star.addEventListener('mouseover', function () {
        var v = parseInt(this.dataset.v);
        stars.forEach(function (s) { s.classList.toggle('active', parseInt(s.dataset.v) <= v); });
      });
      star.addEventListener('mouseout', function () {
        stars.forEach(function (s) { s.classList.toggle('active', parseInt(s.dataset.v) <= selectedRating); });
      });
      star.addEventListener('click', function () {
        selectedRating = parseInt(this.dataset.v);
        stars.forEach(function (s) { s.classList.toggle('active', parseInt(s.dataset.v) <= selectedRating); });
      });
    });

    var photoInput = document.getElementById('sr-photo');
    var photoPreview = document.getElementById('sr-photo-preview');
    var photoName = document.getElementById('sr-photo-name');

    photoInput.addEventListener('change', function () {
      var file = this.files[0];
      if (file) {
        photoName.textContent = file.name;
        var reader = new FileReader();
        reader.onload = function (e) {
          photoPreview.src = e.target.result;
          photoPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });

    var btn = document.getElementById('sr-submit-btn');
    btn.addEventListener('click', function () {
      var author = document.getElementById('sr-author').value.trim();
      var comment = document.getElementById('sr-comment').value.trim();
      var photo = document.getElementById('sr-photo').files[0];

      if (!author) return showMsg('Por favor, informe seu nome.', 'error');
      if (!selectedRating) return showMsg('Por favor, selecione uma nota de 1 a 5 estrelas.', 'error');
      if (comment.length < 10) return showMsg('O depoimento deve ter pelo menos 10 caracteres.', 'error');

      btn.disabled = true;
      btn.textContent = 'Enviando...';

      var fd = new FormData();
      fd.append('product_id', PRODUCT_ID);
      fd.append('author_name', author);
      fd.append('rating', selectedRating);
      fd.append('comment', comment);
      if (photo) fd.append('photo', photo);

      fetch(API_BASE + '/api/reviews', { method: 'POST', body: fd })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.success) {
            showMsg('✅ ' + data.message, 'success');
            document.getElementById('sr-author').value = '';
            document.getElementById('sr-comment').value = '';
            document.getElementById('sr-photo').value = '';
            photoPreview.style.display = 'none';
            photoName.textContent = 'Clique para adicionar uma foto';
            selectedRating = 0;
            stars.forEach(function (s) { s.classList.remove('active'); });
          } else {
            showMsg('❌ ' + (data.error || 'Erro ao enviar. Tente novamente.'), 'error');
          }
        })
        .catch(function () {
          showMsg('❌ Erro de conexão. Tente novamente.', 'error');
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = 'Enviar Avaliação';
        });
    });
  }

  function loadPage(page) {
    currentPage = page;
    var container = document.getElementById(CONTAINER_ID);
    var listEl = document.getElementById('sr-reviews-list-container');
    if (!listEl) return;

    listEl.innerHTML = '<div class="sr-empty">Carregando...</div>';

    fetch(API_BASE + '/api/reviews?product_id=' + encodeURIComponent(PRODUCT_ID) + '&page=' + page + '&limit=' + LIMIT)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        totalReviews = data.stats.total;
        listEl.innerHTML = renderReviews(data.reviews) + renderPagination(page, totalReviews);

        var summaryEl = document.getElementById('sr-summary-container');
        if (summaryEl) summaryEl.innerHTML = renderSummary(data.stats);
      })
      .catch(function () {
        listEl.innerHTML = '<div class="sr-empty">Erro ao carregar avaliações.</div>';
      });
  }

  window.__srLoadPage = loadPage;
  window.__srOpenLightbox = function (url) {
    var lb = document.getElementById('sr-lightbox');
    if (!lb) return;
    lb.querySelector('img').src = url;
    lb.classList.add('open');
  };

  function init() {
    if (!API_BASE || !PRODUCT_ID) {
      console.error('[SensualyReviews] Configure window.SensualyReviews.apiBase e productId antes de carregar o script.');
      return;
    }

    injectStyles();

    var container = document.getElementById(CONTAINER_ID);
    if (!container) {
      console.error('[SensualyReviews] Container #' + CONTAINER_ID + ' não encontrado.');
      return;
    }

    container.innerHTML =
      '<h2 class="sr-section-title">⭐ Avaliações dos Clientes</h2>' +
      '<div id="sr-summary-container"></div>' +
      renderForm() +
      '<h3 class="sr-section-title" style="font-size:17px;margin-top:0">Avaliações</h3>' +
      '<div id="sr-reviews-list-container"><div class="sr-empty">Carregando...</div></div>' +
      '<div id="sr-lightbox" class="sr-lightbox"><span class="sr-lightbox-close" onclick="document.getElementById(\'sr-lightbox\').classList.remove(\'open\')">×</span><img src="" alt="Foto ampliada" /></div>';

    bindForm();
    loadPage(1);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
