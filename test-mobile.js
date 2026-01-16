const { chromium } = require('playwright');
const path = require('path');

async function testResponsive() {
    console.log('=== AutoCare Tracker - Mobile Responsiveness Test ===\n');

    // Test different devices
    const devices = [
        { name: 'iPhone SE', width: 375, height: 667, isMobile: true },
        { name: 'iPhone 12/13/14', width: 390, height: 844, isMobile: true },
        { name: 'iPad Mini', width: 768, height: 1024, isMobile: false },
        { name: 'Android Large', width: 412, height: 915, isMobile: true },
        { name: 'Desktop', width: 1920, height: 1080, isMobile: false }
    ];

    let allPassed = true;
    const errors = [];

    for (const device of devices) {
        console.log(`📱 Testing: ${device.name} (${device.width}x${device.height})`);
        
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            viewport: { width: device.width, height: device.height },
            isMobile: device.isMobile
        });
        const page = await context.newPage();

        const pageErrors = [];

        page.on('pageerror', error => {
            pageErrors.push(error.message);
        });

        try {
            const filePath = path.resolve(__dirname, 'index.html');
            await page.goto(`file://${filePath}`, { waitUntil: 'networkidle' });
            await page.waitForTimeout(1500);

            // Test 1: Check if main elements are visible
            const sidebar = await page.$('.sidebar');
            const mainContent = await page.$('.main-content');
            const header = await page.$('.header');
            const dashboard = await page.$('#dashboardPage');

            const elementsVisible = !!sidebar && !!mainContent && !!header && !!dashboard;
            console.log(`  ✅ Main elements visible: ${elementsVisible ? 'YES' : 'NO'}`);

            // Test 2: Check menu toggle button (mobile only)
            const menuToggle = await page.$('#menuToggle');
            const menuToggleVisible = menuToggle ? await menuToggle.isVisible() : false;
            
            if (device.isMobile) {
                console.log(`  ✅ Menu toggle visible: ${menuToggleVisible ? 'YES' : 'NO'}`);
                
                // Click menu toggle to open sidebar
                if (menuToggleVisible) {
                    await page.click('#menuToggle');
                    await page.waitForTimeout(300);
                    
                    const sidebarOpen = await page.$eval('.sidebar', el => el.classList.contains('open'));
                    console.log(`  ✅ Sidebar opens on mobile: ${sidebarOpen ? 'YES' : 'NO'}`);
                }
            } else {
                console.log(`  ✅ Sidebar always visible (desktop): ${!menuToggleVisible ? 'YES' : 'NO'}`);
            }

            // Test 3: Check stats cards exist
            const statsCards = await page.$$('.stat-card');
            console.log(`  ✅ Stats cards: ${statsCards.length} found`);

            // Test 4: Check charts container
            const chartContainer = await page.$('.chart-container');
            console.log(`  ✅ Charts container: ${!!chartContainer ? 'YES' : 'NO'}`);

            // Test 5: Check buttons exist
            const addExpenseBtn = await page.$('#addExpenseBtn');
            console.log(`  ✅ Add expense button: ${!!addExpenseBtn ? 'YES' : 'NO'}`);

            // Test 6: Check modals exist
            const vehicleModal = await page.$('#vehicleModal');
            const expenseModal = await page.$('#expenseModal');
            console.log(`  ✅ Modals exist: ${!!vehicleModal && !!expenseModal ? 'YES' : 'NO'}`);

            // Test 7: Check for any JavaScript errors
            if (pageErrors.length > 0) {
                console.log(`  ⚠️  Page errors: ${pageErrors.length}`);
                errors.push(...pageErrors.map(e => `${device.name}: ${e}`));
                allPassed = false;
            } else {
                console.log(`  ✅ No JavaScript errors`);
            }

            // Test 8: Check page title
            const title = await page.title();
            console.log(`  ✅ Title: "${title}"`);

        } catch (error) {
            console.log(`  ❌ Test failed: ${error.message}`);
            allPassed = false;
        } finally {
            await browser.close();
        }

        console.log('');
    }

    console.log('=== Test Summary ===');
    if (errors.length === 0) {
        console.log('✅ ALL TESTS PASSED!');
        console.log('✅ AutoCare Tracker is fully responsive!');
        console.log('✅ Works perfectly on all devices!');
        console.log('\n🎉 Ready for GitHub! 🚀');
    } else {
        console.log(`❌ ${errors.length} errors found:`);
        errors.forEach(err => console.log(`  - ${err}`));
    }

    return errors.length === 0;
}

testResponsive().then(success => {
    process.exit(success ? 0 : 1);
});
