/**
 * The chat's loading panel, in the Investigate panel's style (InvestigateProgress: a header with
 * the current stage, the clock and a caret; a progress bar; one row per stage) — but with the
 * chat's own stages, and no invented numbers: no funnel counters, no fake ramps.
 *
 * Every stage is one the chat agent really reports. With GLKB_PROGRESS_VERBOSE on (the default),
 * glkb-agent `service/runner.py` (`_ChatProgress`) sends `progress` frames as the run moves:
 *   planning   — loading its skills and the schema, recalling the conversation
 *   searching  — the knowledge graph and the article search
 *   reading    — abstracts and full text of the papers it found
 *   writing    — once the answer text is streaming
 *   finalizing — after the answer: references, links and the graph view
 * The bar follows the `percent` those frames carry (5/25/55/70/94), which only ever rises. The
 * row under the active stage is the agent's own label for what it is doing right now ("Querying
 * the knowledge graph").
 */
import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import SearchOutlinedIcon from '@mui/icons-material/Search';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';

import { ReactComponent as ChatIcon } from '../../img/llm/chat_message.svg';
import { formatElapsed, useElapsedSeconds } from './InvestigateProgress';

export const CHAT_STAGES = [
    {
        key: 'planning',
        icon: TuneOutlinedIcon,
        active: 'Understanding the question',
        done: 'Understood the question',
    },
    {
        key: 'searching',
        icon: SearchOutlinedIcon,
        active: 'Searching the literature and the knowledge graph',
        done: 'Searched the literature and the knowledge graph',
    },
    {
        key: 'reading',
        icon: VisibilityOutlinedIcon,
        active: 'Reading the papers',
        done: 'Read the papers',
    },
    {
        key: 'writing',
        icon: EditOutlinedIcon,
        active: 'Writing the answer',
        done: 'Wrote the answer',
    },
    {
        key: 'finalizing',
        icon: FactCheckOutlinedIcon,
        active: 'Checking the references',
        done: 'Checked the references',
    },
];

// The deep-research phase names the shared stream helpers may produce, folded onto the chat's.
const PHASE_TO_STAGE = {
    planning: 'planning',
    searching: 'searching',
    screening: 'searching',
    reading: 'reading',
    analyzing: 'reading',
    writing: 'writing',
    verifying: 'finalizing',
    finalizing: 'finalizing',
    summary: 'finalizing',
};

export const chatStageFor = (phase) => PHASE_TO_STAGE[phase] || 'planning';

const ChatProgress = ({
    phase = 'planning',
    // The agent's label for what it is doing now; shown under the active stage.
    label = '',
    // The opening line the agent writes while it starts; shown under "Understanding the question".
    preamble = '',
    percent = null,
    startedAt = null,
    // The run is waiting on the reader (a clarify round): the clock holds still.
    paused = false,
}) => {
    const [expanded, setExpanded] = useState(true);
    const stage = chatStageFor(phase);
    const stageIndex = CHAT_STAGES.findIndex((s) => s.key === stage);
    const elapsedSeconds = useElapsedSeconds(startedAt, !paused);
    const rows = useMemo(() => CHAT_STAGES.slice(0, stageIndex + 1), [stageIndex]);
    const activeText = CHAT_STAGES[stageIndex].active;
    const detail = stage === 'planning'
        ? (preamble || (label && label !== activeText ? label : ''))
        : (label && label !== activeText ? label : '');
    // The agent's percent when it has sent one (it never falls), else the stage's own floor.
    const floor = [5, 25, 55, 70, 94][stageIndex];
    const reported = percent === null || percent === undefined ? NaN : Number(percent);
    const barPct = Number.isFinite(reported) ? Math.max(floor, Math.min(100, reported)) : floor;

    return (
        <Box className="ip-shell chat-progress">
            <Box className="ip-head">
                <button
                    type="button"
                    className="ip-head-left"
                    onClick={() => setExpanded((open) => !open)}
                    aria-expanded={expanded}
                >
                    <ChatIcon className="ip-head-icon chat-progress-icon" aria-hidden="true" />
                    <span className="ip-head-title">{activeText}</span>
                    <ExpandMoreIcon className={`ip-head-caret${expanded ? ' expanded' : ''}`} />
                </button>
                <Box className="ip-head-right">
                    <span className="ip-elapsed" title="Time spent answering">
                        <AccessTimeOutlinedIcon fontSize="inherit" />{formatElapsed(elapsedSeconds)}
                    </span>
                </Box>
            </Box>
            <Box className={`ip-body${expanded ? '' : ' collapsed'}`}>
                <Box className="ip-bar chat-progress-bar" role="progressbar" aria-valuenow={Math.round(barPct)}
                     aria-valuemin={0} aria-valuemax={100}>
                    <Box className="ip-bar-fill" style={{ width: `${barPct}%` }} />
                </Box>
                <Box className="ip-steps">
                    {rows.map((row, index) => {
                        const isActive = index === stageIndex;
                        const Icon = row.icon;
                        return (
                            <Box className={`ip-step${isActive ? ' active' : ' done'}`} key={row.key}>
                                <Box className="ip-step-head">
                                    <Icon className="ip-step-icon" />
                                    <span className="ip-step-label">{isActive ? row.active : row.done}</span>
                                </Box>
                                {isActive && detail ? (
                                    <Box className="ip-step-detail">
                                        <p className="ip-detail-para">{detail}</p>
                                    </Box>
                                ) : null}
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
};

export default ChatProgress;
