// SPDX-License-Identifier: AGPL-3.0-or-later

import { revisionOf } from '../integration/message-controller.js';

function replaceUnique(text, expected, replacement) {
    const first = text.indexOf(expected);
    if (first < 0) throw new Error('The original artifact source is no longer present in the message.');
    if (text.indexOf(expected, first + expected.length) >= 0) {
        throw new Error('The artifact source appears more than once; refusing an ambiguous repair.');
    }
    return text.slice(0, first) + replacement + text.slice(first + expected.length);
}

export function createRepairApplicationService({ getChat, getChatId, saveChat, emitEdited, now = () => Date.now() }) {
    return Object.freeze({
        async apply({ session, originalSource, candidate }) {
            if (String(getChatId() ?? '') !== session.chatId) throw new Error('The active chat changed after the Inspector opened.');
            const message = getChat()?.[Number(session.messageId)];
            if (!message) throw new Error('The artifact message no longer exists.');
            if (revisionOf(message) !== session.revision) throw new Error('The message changed after the Inspector opened. Reopen the Inspector before applying.');
            if (!candidate.trim() || candidate === originalSource) throw new Error('The repair candidate contains no changes.');

            const beforeMessage = message.mes;
            message.mes = replaceUnique(message.mes, originalSource, candidate);
            const revisionAfter = revisionOf(message);
            message.extra ??= {};
            message.extra.ember4Repairs ??= [];
            const record = {
                id: `repair-${now()}`,
                artifactKey: session.artifactKey,
                appliedAt: now(),
                revisionBefore: session.revision,
                revisionAfter,
                originalSource,
                repairedSource: candidate,
                beforeMessage,
            };
            message.extra.ember4Repairs.push(record);
            await saveChat();
            await emitEdited(Number(session.messageId));
            return Object.freeze({ id: record.id, revisionAfter });
        },
        async rollback({ chatId, messageId }) {
            if (String(getChatId() ?? '') !== String(chatId)) throw new Error('Open the chat containing the repair before rolling it back.');
            const message = getChat()?.[Number(messageId)];
            const records = message?.extra?.ember4Repairs ?? [];
            const record = [...records].reverse().find(entry => !entry.rolledBackAt);
            if (!message || !record) throw new Error('No applied Ember repair is available to roll back.');
            if (revisionOf(message) !== record.revisionAfter) throw new Error('The message changed after the repair; automatic rollback is no longer safe.');
            message.mes = replaceUnique(message.mes, record.repairedSource, record.originalSource);
            record.rolledBackAt = now();
            record.rollbackRevision = revisionOf(message);
            await saveChat();
            await emitEdited(Number(messageId));
            return Object.freeze({ id: record.id, rolledBack: true });
        },
    });
}
