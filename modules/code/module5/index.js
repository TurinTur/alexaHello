// This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
// Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
// session persistence, api calls, and more.
const Alexa = require('ask-sdk-core');
const persistenceAdapter = require('ask-sdk-s3-persistence-adapter');
const launchDocument = require('./documents/launchDocument.json');
const birthdayDocument = require('./documents/birthdayDocument.json');

const util = require('./util');

const HasBirthdayLaunchRequestHandler = {
    canHandle(handlerInput) {
        console.log(JSON.stringify(handlerInput.requestEnvelope.request));
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};
        
        const year = sessionAttributes.hasOwnProperty('year') ? sessionAttributes.year : 0;
        const month = sessionAttributes.hasOwnProperty('month') ? sessionAttributes.month : 0;
        const day = sessionAttributes.hasOwnProperty('day') ? sessionAttributes.day : 0;

        return handlerInput.requestEnvelope.request.type === 'LaunchRequest' &&
            year &&
            month &&
            day;
    },
    async handle(handlerInput) {
        
        const serviceClientFactory = handlerInput.serviceClientFactory;
        const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
        
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};
        
        const year = sessionAttributes.hasOwnProperty('year') ? sessionAttributes.year : 0;
        const month = sessionAttributes.hasOwnProperty('month') ? sessionAttributes.month : 0;
        const day = sessionAttributes.hasOwnProperty('day') ? sessionAttributes.day : 0;
        
        let userTimeZone;
        try {
            const upsServiceClient = serviceClientFactory.getUpsServiceClient();
            userTimeZone = await upsServiceClient.getSystemTimeZone(deviceId);    
        } catch (error) {
            if (error.name !== 'ServiceError') {
                return handlerInput.responseBuilder.speak("There was a problem connecting to the service.").getResponse();
            }
            console.log('error', error.message);
        }
        console.log('userTimeZone', userTimeZone);
        
        const oneDay = 24*60*60*1000;
        
        // getting the current date with the time
        const currentDateTime = new Date(new Date().toLocaleString("en-US", {timeZone: userTimeZone}));
        // removing the time from the date because it affects our difference calculation
        const currentDate = new Date(currentDateTime.getFullYear(), currentDateTime.getMonth(), currentDateTime.getDate());
        let currentYear = currentDate.getFullYear();
        
        console.log('currentDateTime:', currentDateTime);
        console.log('currentDate:', currentDate);
        
        // getting the next birthday
        let nextBirthday = Date.parse(`${month} ${day}, ${currentYear}`);
        
        // adjust the nextBirthday by one year if the current date is after their birthday
        if (currentDate.getTime() > nextBirthday) {
            nextBirthday = Date.parse(`${month} ${day}, ${currentYear + 1}`);
            currentYear++;
        }
        
        // setting the default speakOutput to Happy xth Birthday!! 
        // Alexa will automatically correct the ordinal for you.
        // no need to worry about when to use st, th, rd
        const yearsOld = currentYear - year;
        let speakOutput = `Happy ${yearsOld}th birthday!`;
        let isBirthday = true;
        const diffDays = Math.round(Math.abs((currentDate.getTime() - nextBirthday)/oneDay));

        if (currentDate.getTime() !== nextBirthday) {
            isBirthday = false;
            speakOutput = `Welcome back. It looks like there are ${diffDays} days until your ${currentYear - year}th birthday.`
        }
    
        const numberDaysString = diffDays === 1 ? "1 day": diffDays + " days";
        // Add APL directive to response
        if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL']) {
            if (currentDate.getTime() !== nextBirthday) {
                // Create Render Directive
                handlerInput.responseBuilder.addDirective({
                    type: 'Alexa.Presentation.APL.RenderDocument',
                    token: '',
                    document: launchDocument,
                    datasources: {
                        text: {
                            type: 'object',
                            start: "Your Birthday",
                            middle: "is in",
                            end: numberDaysString
                        },
                        assets: {
                            cake: util.getS3PreSignedUrl('Media/alexaCake_960x960.png'),
                            backgroundURL: getBackgroundURL(handlerInput, "lights")
                        }
                    }
                });
            } else {
                // Create Render Directive
                handlerInput.responseBuilder.addDirective({
                    type: 'Alexa.Presentation.APL.RenderDocument',
                    token: 'birthdayToken',
                    document: birthdayDocument,
                    datasources: {
                        text: {
                            type: 'object',
                            start: "Happy Birthday!",
                            middle: "From,",
                            end: "Alexa <3"
                        },
                        assets: {
                            video: "https://public-pics-muoio.s3.amazonaws.com/video/Amazon_Cake.mp4",
                            backgroundURL: getBackgroundURL(handlerInput, "confetti")
                        }
                    }
                }).addDirective({
                    type: "Alexa.Presentation.APL.ExecuteCommands",
                    token: "birthdayToken",
                    commands: [{
                        type: "ControlMedia",
                        componentId: "birthdayVideo",
                        command: "play"
                    }]
                });
            }
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Hello! Welcome to Cake walk. What is your birthday?';
        const repromptOutput = 'I was born Nov. 6th, 2015. When were you born?';

        // Add APL directive to response
        if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL']) {
            // Create Render Directive
            handlerInput.responseBuilder.addDirective({
                type: 'Alexa.Presentation.APL.RenderDocument',
                document: launchDocument,
                datasources: {
                    text: {
                        type: 'object',
                        start: "Welcome",
                        middle: "to",
                        end: "Cake Walk!"
                    },
                    assets: {
                        cake: util.getS3PreSignedUrl('Media/alexaCake_960x960.png'),
                        backgroundURL: getBackgroundURL(handlerInput, "lights")
                    }
                }
            });
        }

        const headerMessage = "Welcome to Cake Walk!";

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};
const BirthdayIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'CaptureBirthdayIntent';
    },
    async handle(handlerInput) {
        const year = handlerInput.requestEnvelope.request.intent.slots.year.value;
        const month = handlerInput.requestEnvelope.request.intent.slots.month.value;
        const day = handlerInput.requestEnvelope.request.intent.slots.day.value;
        
        const attributesManager = handlerInput.attributesManager;
        
        const birthdayAttributes = {
            "year": year,
            "month": month,
            "day": day
            
        };
        attributesManager.setPersistentAttributes(birthdayAttributes);
        await attributesManager.savePersistentAttributes();    
        
        const speakOutput = `Thanks, I'll remember that you were born ${month} ${day} ${year}.`;
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withShouldEndSession(true)
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = handlerInput.requestEnvelope.request.intent.name;
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${error.message}`);
        const speakOutput = `Sorry, I couldn't understand what you said. Please try again.`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const LoadBirthdayInterceptor = {
    async process(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = await attributesManager.getPersistentAttributes() || {};
        
        const year = sessionAttributes.hasOwnProperty('year') ? sessionAttributes.year : 0;
        const month = sessionAttributes.hasOwnProperty('month') ? sessionAttributes.month : 0;
        const day = sessionAttributes.hasOwnProperty('day') ? sessionAttributes.day : 0;
        
        if (year && month && day) {
            attributesManager.setSessionAttributes(sessionAttributes);
        } 
    }
}

function getBackgroundURL(handlerInput, fileNamePrefix) {
    const viewportProfile = Alexa.getViewportProfile(handlerInput.requestEnvelope);
    const backgroundKey = viewportProfile === 'TV-LANDSCAPE-XLARGE' ? "Media/"+fileNamePrefix+"_1920x1080.png" : "Media/"+fileNamePrefix+"_1280x800.png";
    return util.getS3PreSignedUrl(backgroundKey);
}

// This handler acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .withPersistenceAdapter(
        new persistenceAdapter.S3PersistenceAdapter({bucketName:process.env.S3_PERSISTENCE_BUCKET})
    )
    .addRequestHandlers(
        HasBirthdayLaunchRequestHandler,
        LaunchRequestHandler,
        BirthdayIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler) // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    .addErrorHandlers(
        ErrorHandler)
    .addRequestInterceptors(
        LoadBirthdayInterceptor
    )
    .withApiClient(new Alexa.DefaultApiClient())
    .lambda();
