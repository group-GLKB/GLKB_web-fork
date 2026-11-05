/**
 * The example questions under "Ask anything", in their two rows.
 *
 * Each one has a stored answer on the backend (glkb-backend
 * app/resources/example_answers.json, served by services/example_answers.py): the
 * best of several GPT-6.1 Sol answers. A click opens a new chat with the question,
 * and the backend replays that answer — in seconds, the same every time, and free
 * for guests and signed-in readers alike. Change a question here and the backend's
 * copy has to change with it, or the question is simply asked live (and charged).
 */
import { CHAT_NEW_PATH } from '../../config/entryRoutes';

export const EXAMPLE_QUESTIONS = [
    [
        'What is known about DYRK1A as a therapeutic target in type 2 diabetes?',
        'Which genes are associated with both obesity and type 2 diabetes?',
        'What is the evidence for LRRK2 G2019S in Parkinson’s disease?',
        'How does BRCA1 loss sensitize tumors to PARP inhibitors?',
        'Which pathways connect APOE ε4 to tau pathology?',
        'What drives osimertinib resistance in EGFR-mutant lung cancer?',
        'Which variants in PCSK9 lower LDL cholesterol?',
    ],
    [
        'What evidence supports repurposing metformin as an anticancer therapy?',
        'How does TREM2 signaling shape the microglial response to amyloid?',
        'Which circulating biomarkers detect pancreatic cancer early?',
        'How do SGLT2 inhibitors protect the kidney?',
        'What links the gut microbiome to response to immunotherapy?',
        'Which genes regulate both circadian rhythm and insulin secretion?',
        'What is the role of IL-6 signaling in cytokine release syndrome?',
    ],
];

/**
 * Where a click goes: a new AI Chat conversation that asks the question at once, in the
 * search mode the stored answers were made in (all article types, default ranking, no
 * figures or graph) — the home composer's hand-over shape (`initialQuery` /
 * `initialSearchOptions`). No tier: the stored answer is the same on every tier, and one that
 * is not served from the store runs on the default. (Reading the reader's picker here would
 * pull service/serviceTiers.js, and with it axios, into this public page.)
 */
export const exampleChatLink = (question) => ({
    to: CHAT_NEW_PATH,
    state: {
        initialQuery: question,
        initialSearchOptions: {
            filters: [],
            rankingMode: 'default',
            investigateEnabled: false,
            // Read by the chat page only: skip its "not enough credits" check, since the
            // stored answer costs nothing. Not sent to the backend.
            example: true,
        },
        initialQueryMethod: 'example',
    },
});
