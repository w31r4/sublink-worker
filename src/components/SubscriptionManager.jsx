/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */
export const SubscriptionManager = ({ t }) => (
    <details class="mb-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <summary class="font-semibold text-lg cursor-pointer text-gray-900 dark:text-white">{t('managementTitle')}</summary>
        <p class="my-4 text-sm text-gray-600 dark:text-gray-300">{t('managementDescription')}</p>
        <div class="space-y-4">
            <label class="block text-sm text-gray-700 dark:text-gray-300">
                {t('managementToken')}
                <input type="password" x-model="managedToken" autocomplete="off" class="mt-1 w-full border rounded-lg p-2 dark:bg-gray-900" />
            </label>
            <label class="block text-sm text-gray-700 dark:text-gray-300">
                {t('managementCode')}
                <input type="text" x-model="managedCode" placeholder={t('managementCodePlaceholder')} class="mt-1 w-full border rounded-lg p-2 dark:bg-gray-900" />
            </label>
            <div class="flex flex-wrap gap-3">
                <button type="button" x-on:click="loadManagedSubscription()" x-bind:disabled="managedBusy" class="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 dark:text-white disabled:opacity-50">{t('managementLoad')}</button>
                <button type="button" x-on:click="newManagedSubscription()" x-bind:disabled="managedBusy" class="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 dark:text-white disabled:opacity-50">{t('managementNew')}</button>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300">{t('managementFormHint')}</p>
            <label class="block text-sm text-gray-700 dark:text-gray-300">
                {t('managementOverrides')}
                <textarea rows="9" x-model="managedOverrides" spellcheck="false" class="mt-1 w-full border rounded-lg p-3 font-mono text-xs dark:bg-gray-900" />
            </label>
            <button type="button" x-on:click="fillSplitDnsTemplate()" class="text-sm text-primary-600 dark:text-primary-400 underline">{t('managementDnsTemplate')}</button>
            <label class="block text-sm text-gray-700 dark:text-gray-300">
                {t('managementInterval')}
                <input type="number" min="1" max="8760" x-model="managedInterval" class="ml-3 w-24 border rounded-lg p-2 dark:bg-gray-900" />
            </label>
            <button type="button" x-on:click="saveManagedSubscription()" x-bind:disabled="managedBusy" class="px-5 py-3 rounded-lg bg-primary-600 text-white font-semibold disabled:opacity-50">{t('managementSave')}</button>
            <p role="status" x-text="managedMessage" x-bind:class="managedError ? 'text-red-600' : 'text-green-600'" class="text-sm break-words" />
            <div x-show="managedLinks" x-cloak class="space-y-3">
                {['clash', 'singbox', 'surge', 'xray'].map(type => (
                    <label class="block text-sm text-gray-700 dark:text-gray-300">
                        {t(`${type}Link`)}
                        <input readonly type="text" x-bind:value={`managedLinks?.${type} || ''`} class="mt-1 w-full p-2 border rounded-lg font-mono text-sm dark:bg-gray-900" />
                    </label>
                ))}
            </div>
        </div>
    </details>
);
