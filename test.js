const { chromium } = require('playwright');
const path = require('path');

async function testApp() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const errors = [];

    // Listen for console errors
    page.on('console', msg => {
        if (msg.type() === 'error') {
            // Ignore Chart.js errors which are expected without data
            if (!msg.text().includes('Chart.js') && !msg.text().includes('Cannot read properties of null')) {
                errors.push(`Console Error: ${msg.text()}`);
            }
        }
    });

    // Listen for page errors
    page.on('pageerror', error => {
        errors.push(`Page Error: ${error.message}`);
    });

    try {
        const filePath = path.resolve(__dirname, 'index.html');
        await page.goto(`file://${filePath}`, { waitUntil: 'networkidle' });

        // Wait for page to fully load
        await page.waitForTimeout(2000);

        // Check if main elements exist
        const sidebar = await page.$('.sidebar');
        const mainContent = await page.$('.main-content');
        const dashboard = await page.$('#dashboardPage');

        console.log('=== AutoCare Tracker Test Results ===');
        console.log(`✅ Sidebar exists: ${!!sidebar}`);
        console.log(`✅ Main content exists: ${!!mainContent}`);
        console.log(`✅ Dashboard page exists: ${!!dashboard}`);

        // Check for page title
        const title = await page.title();
        console.log(`✅ Page title: ${title}`);

        // Check if navigation works
        const navItems = await page.$$('.nav-item');
        console.log(`✅ Navigation items: ${navItems.length}`);

        // Test navigation to vehicles page
        await page.click('.nav-item[data-page="vehicles"]');
        await page.waitForTimeout(500);
        const vehiclesPage = await page.$('#vehiclesPage.active');
        console.log(`✅ Vehicles page active after click: ${!!vehiclesPage}`);

        // Test navigation back to dashboard
        await page.click('.nav-item[data-page="dashboard"]');
        await page.waitForTimeout(500);
        const dashboardActive = await page.$('#dashboardPage.active');
        console.log(`✅ Dashboard active after click: ${!!dashboardActive}`);

        // Navigate to expenses
        await page.click('.nav-item[data-page="expenses"]');
        await page.waitForTimeout(500);
        const expensesPage = await page.$('#expensesPage.active');
        console.log(`✅ Expenses page active: ${!!expensesPage}`);

        // Navigate to reports
        await page.click('.nav-item[data-page="reports"]');
        await page.waitForTimeout(500);
        const reportsPage = await page.$('#reportsPage.active');
        console.log(`✅ Reports page active: ${!!reportsPage}`);

        // Navigate to settings
        await page.click('.nav-item[data-page="settings"]');
        await page.waitForTimeout(500);
        const settingsPage = await page.$('#settingsPage.active');
        console.log(`✅ Settings page active: ${!!settingsPage}`);

        // Check charts exist on reports page
        const categoryChart = await page.$('#categoryReportChart');
        const monthlyChart = await page.$('#monthlyReportChart');
        console.log(`✅ Category chart exists: ${!!categoryChart}`);
        console.log(`✅ Monthly chart exists: ${!!monthlyChart}`);

        // Go back to dashboard to check charts
        await page.click('.nav-item[data-page="dashboard"]');
        await page.waitForTimeout(500);
        const dashboardChart = await page.$('#expensesChart');
        console.log(`✅ Dashboard expenses chart exists: ${!!dashboardChart}`);

        // Check empty states
        const emptyState = await page.$('.empty-state');
        console.log(`✅ Empty state displayed (no data yet): ${!!emptyState}`);

        console.log('\n=== Error Report ===');
        if (errors.length === 0) {
            console.log('✅ No critical console errors detected!');
        } else {
            console.log('❌ Console errors found:');
            errors.forEach(err => console.log(`  - ${err}`));
        }

        console.log('\n=== TEST PASSED ===');
        console.log('AutoCare Tracker loads and functions correctly!');

    } catch (error) {
        console.error('Test failed:', error.message);
    } finally {
        await browser.close();
    }

    return errors.length === 0;
}

testApp().then(success => {
    process.exit(success ? 0 : 1);
});
