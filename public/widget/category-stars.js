(function () {
  'use strict';

  var API_BASE = window.SensualyCategory ? window.SensualyCategory.apiBase : '';

  var styles = `
    .sr-cat-stars { display: inline-flex; align-items: center; gap: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .sr-cat-star { font-size: 14px; }
    .sr-cat-star.filled { color: #f4a800; }
    .sr-cat-star.empty { color: #ddd; }
    .sr-cat-avg { font-size: 13px; font-weight: 700; color: #e91e8c; margin-left: 2px; }
    .sr-cat-count { font-size: 11px; color: #999; margin-left: 2px; }
  `;

  function injectStyles() {
    if (document.getElementById('sr-cat-styles')) return;
    var s = document.createElement('style');
    s.id = 'sr-cat-styles';
    s.textContent = styles;
    document.head.appendChild(s);
  }

  function starsHTML(rating) {
    var html = '';
    for (var i = 1; i <= 5; i++) {
      var filled = i <= Math.round(rating);
      html += '<span class="sr-cat-star ' + (filled ? 'filled' : 'empty') + '">★</span>';
    }
    return html;
  }

  function renderStars(container, avg, total) {
    if (total === 0) {
      container.innerHTML = '<span class="sr-cat-count">Sem avaliações</span>';
    } else {
      container.innerHTML =
        '<span class="sr-cat-stars">' +
          starsHTML(avg) +
          '<span class="sr-cat-avg">' + avg.toFixed(1) + '</span>' +
          '<span class="sr-cat-count">(' + total + ')</span>' +
        '</span>';
    }
  }

  function loadCategoryStars() {
    if (!API_BASE) {
      console.error('[SensualyCategory] Configure window.SensualyCategory.apiBase');
      return;
    }

    injectStyles();

    var containers = document.querySelectorAll('[data-sr-product-id]');
    if (!containers.length) return;

    var ids = Array.from(containers).map(function (el) {
      return el.getAttribute('data-sr-product-id');
    }).filter(Boolean);

    var uniqueIds = ids.filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (!uniqueIds.length) return;

    containers.forEach(function (el) {
      el.innerHTML = '<span class="sr-cat-count">...</span>';
    });

    fetch(API_BASE + '/api/reviews/summary?product_ids=' + uniqueIds.join(','))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        containers.forEach(function (el) {
          var pid = el.getAttribute('data-sr-product-id');
          var info = data[pid] || { average: 0, total: 0 };
          renderStars(el, info.average, info.total);
        });
      })
      .catch(function () {
        containers.forEach(function (el) {
          el.innerHTML = '';
        });
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCategoryStars);
  } else {
    loadCategoryStars();
  }
})();
