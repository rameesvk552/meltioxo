const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        const htmlPath = path.join(__dirname, 'PerfumeERP-Proposal.html');
        const pdfPath = path.join(__dirname, 'WAYON-PerfumeERP-Proposal.pdf');
        
        console.log('Loading HTML file:', htmlPath);
        // Load with no timeout requirement on external assets
        await page.goto(`file://${htmlPath}`, { waitUntil: 'load', timeout: 0 });
        
        console.log('Generating PDF...');
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '15mm',
                right: '15mm',
                bottom: '15mm',
                left: '15mm'
            }
        });
        
        console.log('PDF generated successfully at:', pdfPath);
        await browser.close();
    } catch (err) {
        console.error('Error generating PDF:', err);
        process.exit(1);
    }
})();
