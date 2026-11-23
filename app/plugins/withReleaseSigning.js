// Config plugin: release builds are signed with our own key and only target 64-bit ABIs.
//
// Signing: reads QUICKPAY_UPLOAD_* Gradle properties (keep them in the user-level
// ~/.gradle/gradle.properties or $GRADLE_USER_HOME/gradle.properties, never in the repo).
// If they are missing, release falls back to the debug key so local builds still work.
//
// ABIs: the gomobile-built Go core (modules/quickpay-core) ships arm64-v8a and x86_64 only,
// so 32-bit builds would crash on launch. Build only what the core supports.
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const MARK = '// quickpay:release-signing';

const SIGNING_CONFIG = `
        ${MARK}
        release {
            if (project.hasProperty('QUICKPAY_UPLOAD_STORE_FILE')) {
                storeFile file(QUICKPAY_UPLOAD_STORE_FILE)
                storePassword QUICKPAY_UPLOAD_STORE_PASSWORD
                keyAlias QUICKPAY_UPLOAD_KEY_ALIAS
                keyPassword QUICKPAY_UPLOAD_KEY_PASSWORD
            }
        }`;

function addSigning(gradle) {
  if (gradle.includes(MARK)) return gradle;
  const withConfig = gradle.replace(/signingConfigs\s*\{/, (m) => `${m}${SIGNING_CONFIG}`);
  // Point the release build type at the release config when the key is available.
  return withConfig.replace(
    /(release\s*\{[^{}]*?)signingConfig signingConfigs\.debug/,
    `$1signingConfig project.hasProperty('QUICKPAY_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`,
  );
}

module.exports = function withReleaseSigning(config) {
  config = withAppBuildGradle(config, (c) => {
    if (c.modResults.language !== 'groovy') throw new Error('withReleaseSigning expects a Groovy build.gradle');
    const next = addSigning(c.modResults.contents);
    if (!next.includes(MARK) || !next.includes('signingConfigs.release')) {
      throw new Error('withReleaseSigning could not patch android/app/build.gradle; the template changed.');
    }
    c.modResults.contents = next;
    return c;
  });
  config = withGradleProperties(config, (c) => {
    const key = 'reactNativeArchitectures';
    const entry = c.modResults.find((p) => p.type === 'property' && p.key === key);
    if (entry) entry.value = 'arm64-v8a,x86_64';
    else c.modResults.push({ type: 'property', key, value: 'arm64-v8a,x86_64' });
    return c;
  });
  return config;
};
