import { StatusBadge } from '@/components/app/ui'
import { Heading } from '@/components/catalyst/heading'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { reminders } from '@/data/mock'
import { useLang } from '@/i18n'

export function RemindersPage() {
  const { t, l } = useLang()
  return (
    <div className="space-y-6">
      <div>
        <Heading className="headline">{t('reminders.title')}</Heading>
        <Text className="mt-1">{t('reminders.subtitle')}</Text>
      </div>
      <Table className="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
        <TableHead>
          <TableRow>
            <TableHeader>{t('reminders.colWhen')}</TableHeader>
            <TableHeader>{t('reminders.colMessage')}</TableHeader>
            <TableHeader>{t('reminders.colTo')}</TableHeader>
            <TableHeader className="max-sm:hidden">{t('reminders.colChannel')}</TableHeader>
            <TableHeader>{t('reminders.colStatus')}</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {reminders.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="tabular-nums">{l(r.when)}</TableCell>
              <TableCell className="font-medium">
                {l(r.message)}
                {r.detail && <div className="text-xs/5 font-normal text-red-700 dark:text-red-400">{l(r.detail)}</div>}
              </TableCell>
              <TableCell>{l(r.to)}</TableCell>
              <TableCell className="text-zinc-500 max-sm:hidden">{t(`forms.${r.channel}`)}</TableCell>
              <TableCell>
                <StatusBadge kind="delivery" status={r.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
