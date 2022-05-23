const { App } = require('@slack/bolt')
const dotenv = require('dotenv');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const { WebClient, LogLevel } = require("@slack/web-api");
const client = new WebClient(process.env.SLACK_BOT_TOKEN, {logLevel: LogLevel.ERROR});
const fs = require('fs');

dotenv.config();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/healthcheck', (req, res) => {
    res.status(200).send('Status: OK');
});

app.post('/summary', async (req, res) => {
    var parameter = req.body.text;
    
    if (parameter != "bounces") {
        res.end('This command doesn\'t work like that');
    }
    
    var messages = await client.search.messages({
        query: 'in:#postmark recipient',
        token: process.env.SLACK_BOT_TOKEN,
        count: 100,
        sort: "timestamp",
        sort_dir: "desc"
    });

    let regex = new RegExp('[a-z0-9]+@[a-z]+\.[a-z]{2,3}');

    var filteredResults = messages.messages.matches
        .filter(x=>x.username === 'postmark bot') // Get everything from the postmark bot
        .map(x => { // Get the email, the reason and message id
            return {"email": x.attachments[0].fields[1].value, "reason": x.attachments[0].author_name, "id": x.ts }
        }) 
        .filter(x=> regex.test(x.email) === true); // Get only the items with an email address that matches the regex
    
    var emailAddresses = filteredResults.map(x=> {
        var rawString = x.email; // Get a copy of the email
        var email = rawString.substring(8); // Remove the <mailto:
        var indexOfSeparator = email.indexOf("|"); // Gets index of the separtor
        email = email.substring(0, indexOfSeparator); // Keep only the email address
        return { "Email":email, "Reason": x.reason };
    });
    
    // Creates a .json file in slack
    await client.files.upload({
        token: process.env.SLACK_BOT_TOKEN,
        channels: "C03E99F4QJV",
        content: JSON.stringify(emailAddresses),
        filetype: "json"
    }).then((response) => {
        if (response.ok) { 
            // When response of the file upload is OK, purge all messages that were used for the summary
            filteredResults.forEach(async (message) => {
                await client.chat.delete({
                    token: process.env.SLACK_BOT_TOKEN,
                    channel: "C03E99F4QJV",
                    ts: message.id
                })
            })
        }
    })
    
    res.end();
});

const server = app.listen(8080, () => {
    console.log('Express server listening on port %d in %s mode', server.address().port, app.settings.env);
});