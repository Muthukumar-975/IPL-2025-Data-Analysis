import pandas as pd
import requests

url = 'https://www.espncricinfo.com/records/tournament/team-match-results/indian-premier-league-2025-16622'

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
}

response = requests.get(url, headers=headers)
response.raise_for_status()

tables = pd.read_html(response.text)

print(f"Total tables found: {len(tables)}")

# Usually the main data is the first or second table, check output to be sure
df = tables[0]
print(df.head())

# Save to CSV if needed
df.to_csv('ipl_2025_team_match_results.csv', index=False)
