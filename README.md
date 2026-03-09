# Stock Count Worksheet App

A free GitHub Pages-friendly stock count app for warehouse cycle counts and paper-form replacement.

## What it does

- Create stock count sessions
- Import item rows from CSV
- Enter counted quantities
- See variance automatically
- Save sessions in the browser with localStorage
- Reload past sessions
- Export current session to CSV
- Export all saved data to JSON backup

## Good to know

This version is built for **GitHub Pages**, so it does **not** need Great Plains or any backend.

Because it uses `localStorage`:

- your data stays in the browser on that device
- if browser data is cleared, saved sessions are lost unless you exported JSON/CSV backups
- it is best as a free proof-of-concept or team demo

## CSV format

Use headers like this:

```csv
site_id,bin,item_number,description,uom,on_hand_qty,lot_serial
OH01,L-91-1,102073,12000 BTU COOL ONLY WINDOW UN,EA,8,
OH01,L-91-1,203180,19" ROUND WHITEFALLS VITREOUS,EA,0,
OH01,L-91-1,416020,5 GALLON BUCKET LID,EA,108,
```

## Run locally

Just open `index.html` in a browser.

## Publish on GitHub Pages

1. Create a new GitHub repo
2. Upload these files
3. Go to **Settings > Pages**
4. Under **Build and deployment**, choose **Deploy from a branch**
5. Select the **main** branch and **/(root)** folder
6. Save
7. Wait about 1 minute
8. Open the Pages URL GitHub gives you

## Upgrade ideas later

- Supabase login + cloud saving
- scanner input for item numbers
- PDF print layout matching your paper sheet
- supervisor approval workflow
- variance dashboard
- mobile barcode support
