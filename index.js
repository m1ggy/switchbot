require('dotenv').config();
const restify = require('restify');
const { CloudAdapter, ConfigurationServiceClientCredentialFactory, TurnContext } = require('botbuilder');
const { saveSubscriber, getSubscribers } = require('./db');

const credentialFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId: process.env.MICROSOFT_APP_ID,
  MicrosoftAppPassword: process.env.MICROSOFT_APP_PASSWORD,
  MicrosoftAppType: 'MultiTenant',
});

const adapter = new CloudAdapter(credentialFactory);

adapter.onTurnError = async (context, error) => {
  console.error('Bot error:', error);
  await context.sendActivity('Sorry, something went wrong.');
};

const server = restify.createServer();
server.use(restify.plugins.bodyParser());

server.listen(3978, () => {
  console.log(`🤖 Bot running at http://localhost:3978`);
});

server.post('/api/messages', async (req, res) => {
  await adapter.process(req, res, async (context) => {
    if (context.activity.type === 'message') {
      const message = context.activity.text.trim().toLowerCase();

      if (message === 'subscribe') {
        const reference = TurnContext.getConversationReference(context.activity);
        const userId = context.activity.from.id;

        await saveSubscriber(userId, reference, {
          name: context.activity.from.name,
          team: context.activity.conversation.tenantId,
        });

        await context.sendActivity('✅ You are now subscribed to call alerts.');
      } else {
        await context.sendActivity('Type `subscribe` to get call alerts in Teams.');
      }
    }
  });
});

// Notify all subscribed users
server.post('/notify', async (req, res) => {
  const message = typeof req.body?.message === 'string'
    ? req.body.message
    : '📞 Incoming call alert!';

  const subs = await getSubscribers();

  if (subs.length === 0) {
    console.log('No subscribers to notify.');
    return res.send(204); // No Content
  }

  await Promise.all(
    subs.map((sub) =>
      adapter.continueConversationAsync(
        process.env.MICROSOFT_APP_ID,
        sub.reference,
        async (context) => {
          await context.sendActivity(message);
        }
      )
    )
  );

  res.send(200);
});
