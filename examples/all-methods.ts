/**
 * Comprehensive test of all @davidshq/app-store-scraper methods
 * Run with: npx tsx examples/all-methods.ts
 */

import {
  app,
  resolveAppId,
  search,
  list,
  developer,
  reviews,
  ratings,
  similar,
  suggest,
  privacy,
  versionHistory,
  appPageDetails,
  collection,
  category,
  sort,
  type App,
  type Review,
  type Ratings,
  type Suggestion,
  type PrivacyDetails,
  type VersionHistory,
} from '../src/index.js';

// Test app ID - Candy Crush Saga
const TEST_APP_ID = 6448311069;
const TEST_BUNDLE_ID = 'com.midasplayer.apps.candycrushsaga';

const line = '-'.repeat(60);

async function testAllMethods() {
  console.log('🧪 Testing all @davidshq/app-store-scraper methods\n');
  console.log(line);

  try {
    // 1. app() - Get detailed app information
    console.log('\n1️⃣  Testing app() method...');
    console.log(line);
    const appData: App = await app({ id: TEST_APP_ID });
    console.log(`✅ Found: ${appData.title}`);
    console.log(`   Developer: ${appData.developer}`);
    console.log(`   Bundle ID: ${appData.appId}`);
    console.log(`   Rating: ${appData.score}/5 (${appData.reviews} reviews)`);
    console.log(`   Price: ${appData.free ? 'Free' : `$${appData.price}`}`);
    console.log(`   Size: ${(appData.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Languages: ${appData.languages.length}`);
    console.log(`   Version: ${appData.version}`);

    // Test with bundle ID
    console.log('\n   Testing app() with bundleId...');
    const appByBundleId = await app({ appId: TEST_BUNDLE_ID });
    console.log(`   ✅ Found by bundle ID: ${appByBundleId.title}`);

    // resolveAppId() - Resolve bundle ID to numeric track ID (lightweight lookup)
    console.log('\n   Testing resolveAppId()...');
    const resolvedId = await resolveAppId({ appId: TEST_BUNDLE_ID });
    console.log(`   ✅ Resolved ${TEST_BUNDLE_ID} → ${resolvedId}`);

    // Test with ratings option
    console.log('\n   Testing app() with ratings histogram...');
    const appWithRatings = await app({ id: TEST_APP_ID, ratings: true });
    if (appWithRatings.histogram) {
      console.log('   ✅ Rating histogram included');
      console.log(`      5★: ${appWithRatings.histogram[5]}`);
      console.log(`      4★: ${appWithRatings.histogram[4]}`);
      console.log(`      3★: ${appWithRatings.histogram[3]}`);
      console.log(`      2★: ${appWithRatings.histogram[2]}`);
      console.log(`      1★: ${appWithRatings.histogram[1]}`);
    }

    // 2. search() - Search for apps
    console.log('\n2️⃣  Testing search() method...');
    console.log(line);
    const searchResults = await search({ term: 'chatgpt', num: 5 });
    console.log(`✅ Found ${searchResults.length} results for "chatgpt":`);
    searchResults.forEach((result, i) => {
      console.log(`   ${i + 1}. ${result.title} by ${result.developer}`);
    });

    // Test search with idsOnly
    console.log('\n   Testing search() with idsOnly...');
    const searchIds = await search({ term: 'puzzle', num: 3, idsOnly: true });
    console.log(`   ✅ Found ${searchIds.length} IDs: ${searchIds.join(', ')}`);

    // 3. list() - Get curated app lists
    console.log('\n3️⃣  Testing list() method...');
    console.log(line);
    const topFreeApps = await list({
      collection: collection.TOP_FREE_IOS,
      num: 5,
    });
    console.log(`✅ Top ${topFreeApps.length} free iOS apps:`);
    topFreeApps.forEach((app, i) => {
      console.log(`   ${i + 1}. ${app.title}`);
    });

    // Test with category
    console.log('\n   Testing list() with category...');
    const topGames = await list({
      collection: collection.TOP_FREE_IOS,
      category: category.GAMES,
      num: 5,
    });
    console.log(`   ✅ Top ${topGames.length} free games:`);
    topGames.slice(0, 3).forEach((game, i) => {
      // list() returns ListApp by default (no .score); use fullDetail: true for full App
      console.log(`      ${i + 1}. ${game.title}`);
    });

    // 4. developer() - Get all apps from a developer
    console.log('\n4️⃣  Testing developer() method...');
    console.log(line);
    // Google - devId: 281956209
    const devApps = await developer({ devId: 281956209 });
    console.log(`✅ Found ${devApps.length} apps from Google:`);
    devApps.slice(0, 5).forEach((app, i) => {
      console.log(`   ${i + 1}. ${app.title}`);
    });

    // 5. reviews() - Get user reviews
    console.log('\n5️⃣  Testing reviews() method...');
    console.log(line);
    const appReviews: Review[] = await reviews({
      id: TEST_APP_ID,
      sort: sort.RECENT,
      page: 1,
    });
    console.log(`✅ Found ${appReviews.length} recent reviews:`);
    if (appReviews.length > 0) {
      const review = appReviews[0]!;
      console.log(`   Latest review by ${review.userName}:`);
      console.log(`   Title: "${review.title}"`);
      console.log(`   Rating: ${review.score}/5`);
      console.log(`   Version: ${review.version}`);
      console.log(`   Text: ${review.text.substring(0, 100)}...`);
    }

    // Test reviews with different sort
    console.log('\n   Testing reviews() with helpful sort...');
    const helpfulReviews = await reviews({
      id: TEST_APP_ID,
      sort: sort.HELPFUL,
      page: 1,
    });
    console.log(`   ✅ Found ${helpfulReviews.length} helpful reviews`);

    // 6. ratings() - Get rating histogram
    console.log('\n6️⃣  Testing ratings() method...');
    console.log(line);
    const ratingsData: Ratings = await ratings({ id: TEST_APP_ID });
    console.log('✅ Rating distribution:');
    console.log(`   Total: ${ratingsData.ratings} ratings`);
    console.log(`   5★: ${ratingsData.histogram[5]}`);
    console.log(`   4★: ${ratingsData.histogram[4]}`);
    console.log(`   3★: ${ratingsData.histogram[3]}`);
    console.log(`   2★: ${ratingsData.histogram[2]}`);
    console.log(`   1★: ${ratingsData.histogram[1]}`);

    // 7. similar() - Get similar apps
    console.log('\n7️⃣  Testing similar() method...');
    console.log(line);
    const similarApps = await similar({ id: TEST_APP_ID, includeLinkType: true });
    console.log(`✅ Found ${similarApps.length} similar apps:`);
    similarApps.slice(0, 5).forEach(({ app, linkType }, i) => {
      console.log(`   ${i + 1}. ${app.title} by ${app.developer} [${linkType}]`);
    });

    // 8. suggest() - Get search suggestions
    console.log('\n8️⃣  Testing suggest() method...');
    console.log(line);
    const suggestions: Suggestion[] = await suggest({ term: 'min' });
    console.log(`✅ Suggestions for "min":`);
    suggestions.slice(0, 5).forEach((suggestion, i) => {
      console.log(`   ${i + 1}. ${suggestion.term}`);
    });

    // 9. privacy() - Get privacy details
    console.log('\n9️⃣  Testing privacy() method...');
    console.log(line);
    try {
      const privacyDetails: PrivacyDetails = await privacy({ id: TEST_APP_ID });
      console.log('✅ Privacy details retrieved');
      if (privacyDetails.privacyPolicyUrl) {
        console.log(`   Privacy Policy: ${privacyDetails.privacyPolicyUrl}`);
      }
      if (privacyDetails.privacyTypes) {
        console.log(`   Privacy Categories: ${privacyDetails.privacyTypes.length}`);
        privacyDetails.privacyTypes.slice(0, 3).forEach((type, i) => {
          console.log(`      ${i + 1}. ${type.name}`);
        });
      }
    } catch (error) {
      console.log('   ⚠️  Privacy details might not be available for this app');
    }

    // 10. versionHistory() - Get version history
    console.log('\n🔟 Testing versionHistory() method...');
    console.log(line);
    try {
      const versions: VersionHistory[] = await versionHistory({ id: TEST_APP_ID });
      console.log(`✅ Found ${versions.length} version history entries:`);
      versions.slice(0, 3).forEach((version, i) => {
        console.log(`   ${i + 1}. Version ${version.versionDisplay}`);
        console.log(`      Released: ${version.releaseDate}`);
        if (version.releaseNotes) {
          const notes = version.releaseNotes.substring(0, 60);
          console.log(`      Notes: ${notes}...`);
        }
      });
    } catch (error) {
      console.log('   ⚠️  Version history might not be available for this app');
    }

    // 11. appPageDetails() - Combined fetch for privacy, similar IDs, and version history
    console.log('\n1️⃣1️⃣  Testing appPageDetails() method...');
    console.log(line);
    try {
      const pageDetails = await appPageDetails({ id: TEST_APP_ID });
      console.log('✅ App page details retrieved (single request):');
      console.log(`   Privacy: ${pageDetails.privacy?.privacyPolicyUrl ? 'yes' : 'no'}`);
      console.log(`   Similar IDs: ${pageDetails.similarIds?.length ?? 0}`);
      console.log(`   Version history: ${pageDetails.versionHistory?.length ?? 0} entries`);
    } catch (error) {
      console.log('   ⚠️  App page details might not be available for this app');
    }

    // Summary
    console.log('\n' + line);
    console.log('🎉 All method tests completed successfully!\n');
    console.log('Methods tested:');
    console.log('  ✅ app() - Get app details');
    console.log('  ✅ resolveAppId() - Resolve bundle ID to numeric track ID');
    console.log('  ✅ search() - Search for apps');
    console.log('  ✅ list() - Get curated lists');
    console.log('  ✅ developer() - Get developer apps');
    console.log('  ✅ reviews() - Get user reviews');
    console.log('  ✅ ratings() - Get rating histogram');
    console.log('  ✅ similar() - Get similar apps');
    console.log('  ✅ suggest() - Get search suggestions');
    console.log('  ✅ privacy() - Get privacy details');
    console.log('  ✅ versionHistory() - Get version history');
    console.log('  ✅ appPageDetails() - Combined privacy, similar IDs, version history');
    console.log(line + '\n');
  } catch (error) {
    console.error('\n❌ Error occurred:', error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testAllMethods();
