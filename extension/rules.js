// One typed catalog for the dashboard, local service, and inference worker.
const n=(key,group,label,value,min,max,unit,help,step=1)=>({key,group,label,value,type:'number',min,max,unit,help,step});
const b=(key,group,label,value,help)=>({key,group,label,value,type:'boolean',help});
const t=(key,group,label,value,help)=>({key,group,label,value,type:Array.isArray(value)?'list':'text',help});
export const settingsVersion=2;
export const classifierVersion='worth-content-v2';
export const groups=[['main','Everyday settings','Choose what matters to you.'],['verdict','Video verdict','When a video is worth your time.'],['filler','Filler & context','Promotion, repetition, and passages to preserve.'],['captions','Original captions','Language preference and reading timeouts.'],['facts','Fact checking','Claims, retrieved sources, and comparison confidence.'],['segments','Video segments','Excerpt size and timeline coverage.'],['model','Laya questions','The English prompts and choices used by the classifier.'],['limits','Limits & memory','Supported input sizes and in-memory retention.']];
export const fields=[
{...t('defaultViewingGoal','main','Default viewing goal','','Optional. Leave blank to understand the whole topic.'),allowEmpty:true},
n('worthRatio','verdict','Useful time needed for “Worth watching”',.7,.1,1,'percent','Share of the full video classified as useful, after unknown gaps are included.',.01),
n('selectiveRatio','verdict','Useful time needed for “Watch selectively”',.15,0,.9,'percent','Below this, the verdict stays uncertain unless filler dominates.',.01),
n('skipRatio','verdict','Filler needed for “You can skip it”',.7,.1,1,'percent','Based on classified intervals, not promotional words alone.',.01),
n('unknownRatio','verdict','Unknown time that makes a verdict uncertain',.2,0,1,'percent','The verdict becomes uncertain above this share of unanalysed time.',.01),
n('minConfidence','verdict','Minimum classification confidence',.5,.3,.95,'percent','Anything below this becomes unknown.',.01),
n('keepConfidence','verdict','High confidence for useful explanation',.85,.5,1,'percent','Lower confidence keeps the explanation at medium confidence.',.01),
n('skipConfidence','filler','Confidence required to mark filler',.9,.5,1,'percent','Only high-confidence filler is eligible for optional automatic skipping.',.01),
b('skipPromotion','main','Identify sponsors and promotions',true,'Advertisements and subscription requests within the spoken content.'),
b('skipIntro','main','Identify empty intros and outros',true,'A strong classification is still required; introductions are not automatically filler.'),
b('skipRepetition','main','Identify exact repetition',true,'Requires matching the previous excerpt and enough distinct words.'),
n('repetitionWords','filler','Minimum distinct words for repetition',20,5,100,'words','Short excerpts are not treated as repetitive.',1),
t('fillerWords','filler','Filler words and phrases',['sponsor','subscribe','subscription','promo code','discount code','thanks for watching','welcome back'],'One phrase per line. A match alone is not enough to mark filler.'),
t('preferredLanguage','captions','Preferred original language','en','Language code such as en or ar. Uses an available original track if missing; no translation.'),
b('preferManual','captions','Prefer authored captions',true,'When several original tracks are available in the preferred language.'),
b('publicFallback','captions','Try public captions if browser reading fails',true,'Contacts YouTube only. YouTube can reject this request.'),
n('panelWaitMs','captions','Transcript panel wait',15000,2000,45000,'ms','Maximum wait; returns sooner when caption rows stabilise.',500),
n('captionTimeoutMs','captions','Player caption request timeout',12000,2000,45000,'ms','Original captions fetched within your Chrome session.',500),
n('maxClaims','facts','Maximum claims to check',5,0,15,'claims','Zero disables claim extraction and the fact-check button.',1),
n('claimConfidence','facts','Confidence for identifying a factual passage',.8,.5,1,'percent','The claim is quoted from the transcript, never generated.',.01),
n('compareConfidence','facts','Confidence required to support or contradict',.9,.5,1,'percent','Lower confidence remains unverified even with a retrieved source.',.01),
n('maxSources','facts','Wikipedia sources per claim',2,1,5,'sources','Number of retrieved articles; not a guarantee of independence or accuracy.',1),
n('searchTerms','facts','Search words per claim',6,3,12,'words','After filtering common words.',1),
n('excerptChars','facts','Maximum source excerpt length',4000,500,8000,'chars','The two closest paragraphs are selected; long text may exceed model capacity.',100),
n('sourceTimeoutMs','facts','Source request timeout',12000,2000,30000,'ms','Missing evidence remains unverified.',500),
n('claimMinChars','facts','Minimum sentence quote length',25,10,100,'chars','Quotes are selected from the original speech.',1),
n('claimMaxChars','facts','Maximum sentence quote length',350,100,600,'chars','Keeps comparisons short and readable.',10),
n('quoteMinChars','facts','Minimum unpunctuated quote length',40,10,100,'chars','For automatic captions without sentence punctuation.',1),
n('quoteMaxChars','facts','Maximum unpunctuated quote length',320,100,600,'chars','Combines consecutive speech from the same excerpt.',10),
n('windowMin','segments','Target excerpt duration',25,20,30,'seconds','Splits at transcript timestamps.',1),
n('windowMax','segments','Maximum excerpt duration',40,30,40,'seconds','Longer excerpts separate filler less precisely.',1),
n('windowChars','segments','Maximum excerpt text length',1100,300,2000,'chars','Starts a new excerpt when this text budget is reached.',50),
n('gapSeconds','segments','Maximum inferred caption duration',5,1,10,'seconds','Only used when end times are missing. Inferred boundaries cannot enable automatic skipping.',1),
n('maxWindows','segments','Maximum analysis excerpts',600,50,1000,'segments','Videos exceeding this need to be split.',10),
n('maxSegments','segments','Maximum analysis intervals',1000,100,1000,'segments','Excess intervals fail explicitly; judgments are never merged across missing coverage.',1),
b('showImportantOnPlayer','main','Highlight useful moments on the player',true,'Marks only Watch segments in green above YouTube’s progress bar after analysis. Applies when Worth next opens; existing judgments are reused.'),
t('typeQuestion','model','Content-type question','What type of text is this?','Changing wording can change Laya accuracy. Keep questions short.'),
t('explanationChoice','model','Useful explanation option','Technical explanation','Description of the internal explanation choice.'),
t('advertisementChoice','model','Advertisement option','Advertisement','Description of the internal advertisement choice.'),
t('storyChoice','model','Story option','Personal anecdote','Stories are preserved; this content-type option is not a filler label.'),
t('greetingChoice','model','Greeting option','Greeting','Introductions still need to pass the filler rules.'),
t('recommendationChoice','model','Opinion or recommendation option','Opinion or recommendation','Meaningful assessments can be useful even when they are not factual claims.'),
t('factQuestion','model','Fact or opinion question','What kind of statement is this?','Only selects quotes for optional source comparison; never affects usefulness.'),
t('factChoice','model','Factual statement option','Factual statement','Description of the internal fact choice.'),
t('opinionChoice','model','Personal opinion option','Personal opinion','Description of the internal opinion choice.'),
t('requestChoice','model','Request option','Request','Description of the internal request choice.'),
t('relevanceQuestion','model','Goal relevance question','Which topic matches this excerpt?','Only used when you enter a viewing goal in the side panel.'),
t('unrelatedChoice','model','Unrelated topic option','Unrelated topic','Your viewing goal is entered in the side panel.'),
t('compareQuestion','model','Source comparison question','Does the source support or contradict the claim?','Uses Supported, Contradicted, and Not enough information choices.'),
n('analyzeTokens','model','Laya analysis token budget',2048,512,4096,'tokens','Excerpts truncated by the model stay unknown.',128),
n('compareTokens','model','Laya comparison token budget',4096,1024,8192,'tokens','Larger budgets use more memory and processing time.',128),
n('maxDuration','limits','Maximum video duration',21600,60,21600,'seconds','The supported upper limit is six hours.',60),
n('maxCues','limits','Maximum caption timestamps',20000,100,20000,'cues','Limits transcript size.',100),
n('maxTextChars','limits','Maximum video transcript length',160000,1000,160000,'chars','Text budget supported by this version.',1000),
n('maxCueChars','limits','Maximum single caption length',12000,500,12000,'chars','Protects reading large transcript files.',100),
n('cacheEntries','limits','Analysis results kept in memory',20,0,100,'videos','Zero disables reuse; the current result remains available for fact checking.',1),
n('cacheHours','limits','Analysis retention time',6,1,24,'hours','Memory only. Transcripts are never written to disk.',1)
];
export const defaults=Object.fromEntries(fields.map(f=>[f.key,f.value]));
export function validateRules(value){
 if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('Invalid rules file.');
 const unknown=Object.keys(value).filter(k=>!fields.some(f=>f.key===k));if(unknown.length)throw new Error('Unknown rule: '+unknown[0]);
 const result={};for(const f of fields){const v=value[f.key];
 if(f.type==='number' && (typeof v!=='number'||!Number.isFinite(v)||v<f.min||v>f.max|| (f.step>=1&&!Number.isInteger(v))))throw Object.assign(new Error(`“${f.label}” is outside its allowed range.`),{field:f.key});
 if(f.type==='boolean' && typeof v!=='boolean')throw Object.assign(new Error(`Invalid value for “${f.label}”.`),{field:f.key});
 if(f.type==='text' && (typeof v!=='string'||(!f.allowEmpty&&!v.trim())||v.length>(f.key==='defaultViewingGoal'?300:600)))throw Object.assign(new Error(`Enter a short description for “${f.label}”.`),{field:f.key});
 if(f.type==='list' && (!Array.isArray(v)||v.length>100||v.some(s=>typeof s!=='string'||!s.trim()||s.length>120)))throw Object.assign(new Error(`Invalid phrases for “${f.label}”.`),{field:f.key});
 result[f.key]=f.type==='text'?v.trim():f.type==='list'?[...new Set(v.map(s=>s.trim()))]:v;
 }
 for(const [a,b] of [['selectiveRatio','worthRatio'],['minConfidence','keepConfidence'],['windowMin','windowMax'],['claimMinChars','claimMaxChars'],['quoteMinChars','quoteMaxChars']])if(result[a]>result[b])throw Object.assign(new Error('Minimum values must not exceed their upper limits.'),{field:a});
 if(!/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(result.preferredLanguage))throw Object.assign(new Error('Invalid language code. Try en or en-US.'),{field:'preferredLanguage'});
 return result;
}

// Presentation/retention changes do not invalidate classification judgments.
export const presentationKeys=['showImportantOnPlayer'];
export const retentionKeys=['cacheHours','cacheEntries'];
export const sourceKeys=fields.filter(f=>f.group==='facts'||['compareQuestion','compareTokens'].includes(f.key)).map(f=>f.key);
export const classifierKeys=fields.filter(f=>['model','segments','filler','verdict'].includes(f.group)||['minConfidence','keepConfidence'].includes(f.key)).map(f=>f.key).filter(k=>!sourceKeys.includes(k));
export function isRecommended(rules){return classifierKeys.every(k=>JSON.stringify(rules[k])===JSON.stringify(defaults[k]));}
export function analysisRules(rules){return Object.fromEntries(fields.filter(f=>![...presentationKeys,...retentionKeys,'defaultViewingGoal'].includes(f.key)).map(f=>[f.key,rules[f.key]]));}
export function migrateSettings(data){
 if(!data||![1,settingsVersion].includes(data.version)||!data.rules||typeof data.rules!=='object'||Array.isArray(data.rules))throw new Error('Unsupported settings file.');
 if(data.version===settingsVersion)return {rules:validateRules(data.rules),notes:[]};
 const removed=['mixedConfidence','requireFillerWords','protectFacts','protectUncertainNonFacts','repetitionSimilarity','storyWords','windowDivisor'];
 const unknown=Object.keys(data.rules).find(k=>!fields.some(f=>f.key===k)&&!removed.includes(k));
 if(unknown)throw new Error('Unknown rule: '+unknown);
 const next={...defaults},notes=['Migrated version 1 settings. Retired penalties were removed; excerpt timing uses the recommended safe limits.'];
 for(const f of fields)if(f.key in data.rules)next[f.key]=data.rules[f.key];
 // Old timing and display-compression settings cannot preserve the new coverage contract.
 for(const key of ['windowMin','windowMax','gapSeconds','maxSegments'])next[key]=defaults[key];
 return {rules:validateRules(next),notes};
}
