const { CHINA_EDITION } = require('./scripts/release/edition')

module.exports = async function createChinaEditionConfig({ packageMetadata }) {
  void packageMetadata
  return {
    extends: './electron-builder.yml',
    appId: 'com.ott24x7.ai',
    extraMetadata: {
      cherryEdition: CHINA_EDITION
    }
  }
}
