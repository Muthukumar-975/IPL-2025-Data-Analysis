const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const resultsURL = 'https://www.espncricinfo.com/records/tournament/team-match-results/indian-premier-league-2025-16622';
  await page.goto(resultsURL, { waitUntil: 'networkidle2' });

  const matchLinks = await page.$$eval('tbody tr td:last-child a', links =>
    links.map(link => 'https://www.espncricinfo.com' + link.getAttribute('href'))
  );

  console.log(`✅ Found ${matchLinks.length} matches.`);

  const playerMap = new Map();

  for (const matchUrl of matchLinks) {
    const matchPage = await browser.newPage();
    try {
      console.log(`🔎 Visiting: ${matchUrl}`);
      await matchPage.goto(matchUrl, { waitUntil: 'domcontentloaded', timeout: 0 });

      const players = await matchPage.evaluate(() => {
        const result = [];
        const inningsBlocks = document.querySelectorAll('div.ds-rounded-lg');

        inningsBlocks.forEach((block, idx) => {
          const teamSpan = block.querySelector('span.ds-text-title-xs');
          let teamName = teamSpan ? teamSpan.textContent.trim() : `Team ${idx + 1}`;
          teamName = teamName.split('  ')[0].split(' (')[0].split(' (')[0].trim();

          const table = block.querySelector('table');
          if (!table) return;

          const rows = table.querySelectorAll('tbody tr');
          rows.forEach(row => {
            const tds = row.querySelectorAll('td');
            if (tds.length < 8) return;

            const linkEl = tds[0].querySelector('a');
            const nameEl = linkEl?.querySelector('span > span');
            const name = nameEl?.textContent.trim();
            const url = linkEl?.href;

            if (name && url) {
              result.push({
                name,
                team: teamName,
                url: url.startsWith('http') ? url : 'https://www.espncricinfo.com' + url
              });
            }
          });
        });

        // Bowling tables
        const bowlingTables = document.querySelectorAll('table.ds-w-full.ds-table.ds-table-md.ds-table-auto');
        if (bowlingTables.length >= 2) {
          [1, 3].forEach((i, index) => {
            const team = inningsBlocks[index]?.querySelector('span.ds-text-title-xs')?.textContent.trim().split('  ')[0].split(' (')[0].split(' (')[0].trim() || `Team ${index + 1}`;
            const rows = bowlingTables[i]?.querySelectorAll('tbody tr') || [];
            rows.forEach(row => {
              const tds = row.querySelectorAll('td');
              if (tds.length < 11) return;
              const linkEl = tds[0].querySelector('a');
              const name = linkEl?.textContent.trim();
              const url = linkEl?.href;
              if (name && url) {
                result.push({
                  name,
                  team,
                  url: url.startsWith('http') ? url : 'https://www.espncricinfo.com' + url
                });
              }
            });
          });
        }

        return result;
      });

      players.forEach(p => {
        if (!playerMap.has(p.url)) {
          playerMap.set(p.url, { name: p.name, team: p.team });
        }
      });

    } catch (err) {
      console.error(`❌ Error at ${matchUrl}: ${err.message}`);
    } finally {
      await matchPage.close();
      await new Promise(res => setTimeout(res, 500));
    }
  }

  console.log(`🔢 Unique players collected: ${playerMap.size}`);

  const allPlayers = [];

  for (const [url, { name, team }] of playerMap.entries()) {
    const page = await browser.newPage();
    try {
      console.log(`📥 Scraping ${name} (${team}) → ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });
      await page.waitForTimeout(1500); // Allow content to load fully

      await page.waitForSelector('div.ds-grid', { timeout: 5000 }).catch(() => null);

      const data = await page.evaluate(() => {
        function getLabel(label) {
          const divs = [...document.querySelectorAll('div.ds-grid div')];
          for (const div of divs) {
            const keyEl = div.querySelector('p');
            if (!keyEl) continue;

            const key = keyEl.textContent.trim().toLowerCase();
            if (key === label.toLowerCase()) {
              const spanValue = div.querySelector('span')?.textContent?.trim();
              const pTags = div.querySelectorAll('p');
              if (spanValue) return spanValue;
              if (pTags.length >= 2) return pTags[1].textContent.trim();
            }
          }
          return 'N/A';
        }

        const description =
          [...document.querySelectorAll('div.ci-player-bio-content p')]
            .map(p => p.textContent.trim())
            .join('\n\n') || 'N/A';

        return {
          battingStyle: getLabel('Batting Style'),
          bowlingStyle: getLabel('Bowling Style'),
          playingRole: getLabel('Playing Role'),
          description
        };
      });

      allPlayers.push({
        name: name || 'Unknown',
        team: team || 'Unknown',
        battingStyle: data.battingStyle,
        bowlingStyle: data.bowlingStyle,
        playingRole: data.playingRole,
        description: data.description
      });

    } catch (err) {
      console.error(`❌ Failed for ${name}: ${err.message}`);
    } finally {
      await page.close();
      await new Promise(res => setTimeout(res, 750));
    }
  }

  fs.writeFileSync('ipl2025_player_info_cleaned.json', JSON.stringify(allPlayers, null, 2));
  console.log('✅ All player info saved to ipl2025_player_info_cleaned.json');

  await browser.close();
})();
