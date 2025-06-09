const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  
  const resultsURL = 'https://www.espncricinfo.com/records/tournament/team-match-results/indian-premier-league-2025-16622';
  await page.goto(resultsURL, { waitUntil: 'networkidle2' });

  
  const matchLinks = await page.$$eval('table tbody tr td:last-child a', links =>
    links.map(link => 'https://www.espncricinfo.com' + link.getAttribute('href'))
  );

  console.log(`Found ${matchLinks.length} matches.`);

  const fullBattingSummary = [];

  for (const matchUrl of matchLinks) {
    console.log(`Processing: ${matchUrl}`);
    try {
      const matchPage = await browser.newPage();
      await matchPage.goto(matchUrl, { waitUntil: 'networkidle2' });

      const matchInfo = await matchPage.title().then(title => title.split('|')[0].trim());

      const summary = await matchPage.$$eval('div.ds-rounded-lg', (sections, matchInfo) => {
        const battingSummary = [];

        sections.forEach((section, idx) => {
          const teamSpan = section.querySelector('span.ds-text-title-xs.ds-font-bold.ds-capitalize');
          const teamName = teamSpan ? teamSpan.textContent.trim() : `Team ${idx + 1}`;

          const table = section.querySelector('table.ds-w-full.ds-table.ds-table-xs.ds-table-auto');
          if (!table) return;

          const rows = table.querySelectorAll('tbody tr');
          let pos = 1;
          rows.forEach(row => {
            const tds = row.querySelectorAll('td');
            if (tds.length < 8) return;

            const batsmanName = tds[0]?.querySelector('a > span > span')?.textContent.trim().replace('\u00A0', '');
            const dismissal = tds[1]?.querySelector('span > span')?.textContent.trim();
            const runs = tds[2]?.querySelector('strong')?.textContent.trim();
            const balls = tds[3]?.textContent.trim();
            const fours = tds[5]?.textContent.trim();
            const sixes = tds[6]?.textContent.trim();
            const sr = tds[7]?.textContent.trim();

            if (batsmanName) {
              battingSummary.push({
                match: matchInfo,
                teamInnings: teamName,
                battingPos: pos++,
                batsmanName,
                dismissal,
                runs,
                balls,
                "4s": fours,
                "6s": sixes,
                SR: sr
              });
            }
          });
        });

        return battingSummary;
      }, matchInfo);

      fullBattingSummary.push(...summary);
      await matchPage.close();
    } catch (err) {
      console.error(`Failed to process ${matchUrl}`, err.message);
    }
  }

  fs.writeFileSync('all_batting_summary.json', JSON.stringify(fullBattingSummary, null, 2));
  console.log("All batting summaries saved to all_batting_summary.json");

  await browser.close();
})();
