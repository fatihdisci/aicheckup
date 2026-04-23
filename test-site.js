const cheerio = require('cheerio');
fetch('https://airbagtr.com/').then(r => r.text()).then(html => {
  const $ = cheerio.load(html);
  
  $('script, style, noscript, nav, footer, iframe, svg, header, aside, .menu, .navigation, #sidebar, .sidebar, .elementor-location-header, [data-elementor-type="header"], .site-header, #masthead, .elementor-location-footer, [data-elementor-type="footer"], .skip-link, .screen-reader-text').remove();
  
  let mainContent = $('main');
  if (mainContent.length === 0) mainContent = $('article');
  if (mainContent.length === 0) mainContent = $('#content');
  if (mainContent.length === 0) mainContent = $('.content');
  if (mainContent.length === 0) mainContent = $('body'); // Fallback

  const h1 = mainContent.find('h1').map((i, el) => $(el).text().trim()).get().join(' | ');
  const h2 = mainContent.find('h2').map((i, el) => $(el).text().trim()).get().slice(0, 5).join(' | ');
  let txt = mainContent.text().replace(/\s+/g, ' ').trim().substring(0, 500);

  console.log('H1:', h1);
  console.log('H2:', h2);
  console.log('Text:', txt);
});