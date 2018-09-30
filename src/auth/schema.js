export default {
  type: 'object',
  title: 'Social Login',
  description: 'Settings for third party login integrations like Google.',
  'uw:needsRestart': true,
  properties: {
    google: {
      type: 'object',
      title: 'Google Authentication',
      description: 'Settings for the Google authentication integration.',
      properties: {
        enabled: {
          type: 'boolean',
          title: 'Enabled',
          default: false,
        },
        clientID: {
          type: 'string',
          title: 'Client ID',
          description: 'The OAuth2 Client ID.',
        },
        clientSecret: {
          type: 'string',
          title: 'Client Secret',
          description: 'The secret key.',
        },
        callbackURL: {
          type: 'string',
          format: 'uri-reference',
          title: 'Callback URL',
          description: 'The URL that Google will redirect to once a signin is complete. This URL should contain the code that finalizes the login on the üWave end.',
        },
      },
      required: ['enabled'],
      // When enabled, clientID and clientSecret are required.
      dependencies: {
        enabled: ['clientID', 'clientSecret'],
      },
      default: {}
    },
  },
  required: ['google'],
};
