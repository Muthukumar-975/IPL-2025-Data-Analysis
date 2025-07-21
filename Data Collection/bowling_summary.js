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

  console.log(`📄 Found ${matchLinks.length} matches.`);

  const fullBowlingSummary = [];

  for (const matchUrl of matchLinks) {
    console.log(`🔗 Processing: ${matchUrl}`);
    try {
      const matchPage = await browser.newPage();
      await matchPage.goto(matchUrl, { waitUntil: 'networkidle2' });

      
      await matchPage.addScriptTag({ url: 'https://code.jquery.com/jquery-3.6.0.min.js' });

      const summary = await matchPage.evaluate(() => {
        const $ = window.$;
        const matchInfo = document.title.split("|")[0].trim();
        const bowlingSummary = [];

        const teams = $('span.ds-text-title-xs.ds-font-bold.ds-capitalize').map((i, el) =>
          $(el).text().trim()
        ).get();

        const team1 = teams[0] || "Team 1";
        const team2 = teams[1] || "Team 2";

        const tables = $('table.ds-w-full.ds-table.ds-table-xs.ds-table-auto');
        const firstInningRows = tables.eq(1).find('tbody > tr');
        const secondInningsRows = tables.eq(3).find('tbody > tr');

        firstInningRows.each((index, element) => {
          const tds = $(element).find('td');
          if (tds.length < 11) return;

          bowlingSummary.push({
            match: matchInfo,
            bowlingTeam: team2,
            bowlerName: $(tds.eq(0)).find('a > span').text().replace('\u00A0', '').trim(),
            overs: $(tds.eq(1)).text().trim(),
            maiden: $(tds.eq(2)).text().trim(),
            runs: $(tds.eq(3)).text().trim(),
            wickets: $(tds.eq(4)).text().trim(),
            economy: $(tds.eq(5)).text().trim(),
            "0s": $(tds.eq(6)).text().trim(),
            "4s": $(tds.eq(7)).text().trim(),
            "6s": $(tds.eq(8)).text().trim(),
            wides: $(tds.eq(9)).text().trim(),
            noBalls: $(tds.eq(10)).text().trim()
          });
        });

        secondInningsRows.each((index, element) => {
          const tds = $(element).find('td');
          if (tds.length < 11) return;

          bowlingSummary.push({
            match: matchInfo,
            bowlingTeam: team1,
            bowlerName: $(tds.eq(0)).find('a > span').text().replace('\u00A0', '').trim(),
            overs: $(tds.eq(1)).text().trim(),
            maiden: $(tds.eq(2)).text().trim(),
            runs: $(tds.eq(3)).text().trim(),
            wickets: $(tds.eq(4)).text().trim(),
            economy: $(tds.eq(5)).text().trim(),
            "0s": $(tds.eq(6)).text().trim(),
            "4s": $(tds.eq(7)).text().trim(),
            "6s": $(tds.eq(8)).text().trim(),
            wides: $(tds.eq(9)).text().trim(),
            noBalls: $(tds.eq(10)).text().trim()
          });
        });

        return bowlingSummary;
      });

      fullBowlingSummary.push(...summary);
      await matchPage.close();
    } catch (err) {
      console.error(`Failed to process ${matchUrl}`, err.message);
    }
  }

  fs.writeFileSync('all_bowling_summary.json', JSON.stringify(fullBowlingSummary, null, 2));
  console.log("All bowling summaries saved to all_bowling_summary.json");

  await browser.close();
})();
