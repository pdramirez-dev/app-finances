"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQL_PARAM_TYPE_HINTS = void 0;
exports.sqlTypeHint = sqlTypeHint;
exports.sqlVariables = sqlVariables;
exports.SQL_PARAM_TYPE_HINTS = {
    acc: "UUID",
    id: "UUID",
    clientId: "UUID",
    invoiceId: "UUID",
    sectionId: "UUID",
    lineItemId: "UUID",
    seriesId: "UUID",
    bankAccountId: "UUID",
    contactId: "UUID",
    opportunityId: "UUID",
    projectId: "UUID",
    paymentId: "UUID",
    movementId: "UUID",
    reminderId: "UUID",
    date: "DATE",
    dueDate: "DATE",
    bookedOn: "DATE",
    valueOn: "DATE",
};
function sqlTypeHint(name) {
    return Object.hasOwn(exports.SQL_PARAM_TYPE_HINTS, name) ? exports.SQL_PARAM_TYPE_HINTS[name] : undefined;
}
/** variableMap and variableTypeHintMap for an AppSync RDS resolver request. */
function sqlVariables(params) {
    const variableMap = {};
    const variableTypeHintMap = {};
    for (const [name, value] of Object.entries(params)) {
        variableMap[`:${name}`] = value;
        const hint = sqlTypeHint(name);
        if (hint)
            variableTypeHintMap[`:${name}`] = hint;
    }
    return { variableMap, variableTypeHintMap };
}
