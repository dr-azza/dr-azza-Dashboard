import { formatPhone, RequestError, useFormat } from '@/components/app/form'
import { SidePanel } from '@/components/app/side-panel'
import { ToneBadge } from '@/components/app/ui'
import { Button } from '@/components/catalyst/button'
import { Description, Field, FieldGroup, Label } from '@/components/catalyst/fieldset'
import { Heading } from '@/components/catalyst/heading'
import { Input } from '@/components/catalyst/input'
import { Radio, RadioField, RadioGroup } from '@/components/catalyst/radio'
import { Switch, SwitchField } from '@/components/catalyst/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { CopyLinkButton } from '@/components/forms/copy-link-button'
import { useLang } from '@/i18n'
import { ApiError } from '@/lib/api'
import { inviteLinkUrl, useAddMember, useMe, useSendMemberLink, useTeam, useUpdateMember } from '@/lib/queries'
import {
  canManageTeam,
  CreateStaffSchema,
  STAFF_INVITE_TTL_DAYS,
  STAFF_ROLES,
  type StaffInviteDto,
  type StaffStatus,
  type TeamMemberDto,
  type Tone,
} from '@azza/shared'
import { KeyIcon, PencilSquareIcon, PlusIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'

const statusTone: Record<StaffStatus, Tone> = { active: 'ok', invited: 'info', inactive: 'neutral' }

const KNOWN_ERRORS = ['EMAIL_TAKEN', 'LAST_OWNER', 'SELF_DEACTIVATE', 'INACTIVE_MEMBER']
/** The API's machine-readable reason, when it's one we have words for. */
const errorCode = (error: unknown) => {
  const code = error instanceof ApiError ? (error.body as { code?: string } | null)?.code : undefined
  return code && KNOWN_ERRORS.includes(code) ? code : null
}

/** Everyone who can sign in: owners add, edit and deactivate members; everyone else can look. */
export function TeamPage() {
  const { t } = useLang()
  const fmt = useFormat()
  const me = useMe()
  const team = useTeam()
  const canManage = canManageTeam(me.data?.role ?? '')
  const [editing, setEditing] = useState<TeamMemberDto | 'new' | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading className="headline">{t('team.title')}</Heading>
          <Text className="mt-1">{t('team.subtitle')}</Text>
        </div>
        {canManage && (
          <Button color="brand" onClick={() => setEditing('new')}>
            <PlusIcon />
            {t('team.add')}
          </Button>
        )}
      </div>
      {!canManage && me.isSuccess && (
        <p className="rounded-lg bg-zinc-50 px-4 py-2.5 text-sm/6 text-zinc-600 ring-1 ring-zinc-950/5 dark:bg-white/5 dark:text-zinc-400 dark:ring-white/10">
          {t('team.viewOnly')}
        </p>
      )}

      <RequestError error={team.error} />
      {team.isPending && <div className="h-48 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/5" />}
      {!!team.data?.length && (
        <Table className="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
          <TableHead>
            <TableRow>
              <TableHeader>{t('team.name')}</TableHeader>
              <TableHeader className="max-lg:hidden">{t('team.phone')}</TableHeader>
              <TableHeader>{t('team.role')}</TableHeader>
              <TableHeader>{t('team.status')}</TableHeader>
              <TableHeader className="max-md:hidden">{t('team.lastSignIn')}</TableHeader>
              {canManage && (
                <TableHeader>
                  <span className="sr-only">{t('team.edit')}</span>
                </TableHeader>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {team.data.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium text-zinc-950 dark:text-white">
                    {m.fullName}
                    {m.isYou && <ToneBadge tone="neutral">{t('team.you')}</ToneBadge>}
                  </div>
                  <div className="text-xs/5 text-zinc-500" dir="ltr">
                    <span className="inline-block">{m.email}</span>
                  </div>
                </TableCell>
                <TableCell className="text-zinc-600 max-lg:hidden dark:text-zinc-400">
                  {m.phone ? <bdi dir="ltr">{formatPhone(m.phone)}</bdi> : '—'}
                </TableCell>
                <TableCell>{t(`team.roles.${m.role}`)}</TableCell>
                <TableCell>
                  <ToneBadge tone={statusTone[m.status]}>{t(`team.statuses.${m.status}`)}</ToneBadge>
                  {m.pendingInvite && m.status !== 'inactive' && (
                    <div className="mt-1 text-xs/5 text-zinc-500">
                      {t(m.status === 'invited' ? 'team.pendingInvite' : 'team.pendingReset', {
                        when: fmt.day(m.pendingInvite.expiresAt),
                      })}
                      {m.pendingInvite.sentBy && ` · ${t('team.sentBy', { name: m.pendingInvite.sentBy })}`}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-zinc-500 tabular-nums max-md:hidden">
                  {m.lastLoginAt ? fmt.dayTime(m.lastLoginAt) : t('team.never')}
                </TableCell>
                {canManage && (
                  <TableCell className="text-end">
                    <Button plain onClick={() => setEditing(m)}>
                      <PencilSquareIcon />
                      {t('team.edit')}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editing && (
        <MemberPanel
          key={editing === 'new' ? 'new' : editing.id}
          member={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

/** Add or edit a member. After adding (or on request) it shows a one-time set-password link. */
function MemberPanel({ member, onClose }: { member?: TeamMemberDto; onClose: () => void }) {
  const { t } = useLang()
  const add = useAddMember()
  const update = useUpdateMember()
  const sendLink = useSendMemberLink()
  const [role, setRole] = useState<TeamMemberDto['role']>(member?.role ?? 'NURSE')
  const [active, setActive] = useState(member ? member.status !== 'inactive' : true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [link, setLink] = useState<StaffInviteDto | null>(null)
  const current = link?.member ?? member
  const pending = add.isPending || update.isPending
  const error = add.error ?? update.error ?? sendLink.error

  // Once a link is showing, the panel is about that link: copy it, then close.
  if (link) {
    const name = link.member.fullName
    const isReset = link.member.status === 'active'
    return (
      <SidePanel
        open
        onClose={onClose}
        size="lg"
        title={member ? t('team.editTitle') : t('team.addTitle')}
        actions={
          <Button color="brand" onClick={onClose}>
            {t('common.done')}
          </Button>
        }
      >
        <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900">
          <p className="text-sm/6 font-medium text-emerald-900 dark:text-emerald-200">
            {t(isReset ? 'team.resetReady' : 'team.inviteReady', { name, days: STAFF_INVITE_TTL_DAYS })}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Input
              className="min-w-0 flex-1"
              readOnly
              dir="ltr"
              value={inviteLinkUrl(link.token)}
              aria-label={name}
              onFocus={(e) => e.currentTarget.select()}
            />
            <CopyLinkButton url={inviteLinkUrl(link.token)} />
          </div>
        </div>
      </SidePanel>
    )
  }

  return (
    <SidePanel
      open
      onClose={onClose}
      size="lg"
      title={member ? t('team.editTitle') : t('team.addTitle')}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault()
        const f = new FormData(event.currentTarget)
        const parsed = CreateStaffSchema.safeParse({
          fullName: String(f.get('fullName') ?? ''),
          email: String(f.get('email') ?? ''),
          phone: String(f.get('phone') ?? ''),
          role,
        })
        if (!parsed.success) {
          const found: Record<string, string> = {}
          for (const issue of parsed.error.issues) {
            const key = String(issue.path[0])
            found[key] = t(`team.errors.${key === 'fullName' ? 'name' : key}`)
          }
          return setErrors(found)
        }
        setErrors({})
        try {
          if (!member) {
            setLink(await add.mutateAsync(parsed.data))
            return
          }
          const d = parsed.data
          const changes = {
            ...(d.fullName !== member.fullName && { fullName: d.fullName }),
            ...(d.email !== member.email && { email: d.email }),
            ...((d.phone ?? null) !== member.phone && { phone: d.phone ?? null }),
            ...(d.role !== member.role && { role: d.role }),
            ...(active !== (member.status !== 'inactive') && { active }),
          }
          // Nothing changed: just close (no request, no audit entry).
          if (Object.keys(changes).length) await update.mutateAsync({ id: member.id, ...changes })
          onClose()
        } catch {
          // Shown below (e.g. email already used, or the last owner).
        }
      }}
      actions={
        <>
          <Button plain onClick={onClose}>
            {t('record.cancel')}
          </Button>
          <Button type="submit" color="brand" disabled={pending}>
            {member ? t('team.save') : t('team.create')}
          </Button>
        </>
      }
    >
      <FieldGroup>
        <Field>
          <Label>{t('team.name')}</Label>
          <Input
            name="fullName"
            autoFocus={!member}
            defaultValue={member?.fullName}
            invalid={!!errors.fullName}
            autoComplete="off"
          />
          {errors.fullName && <p className="mt-2 text-sm/6 text-red-600">{errors.fullName}</p>}
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <Label>{t('team.email')}</Label>
            <Input
              name="email"
              type="email"
              dir="ltr"
              defaultValue={member?.email}
              invalid={!!errors.email}
              autoComplete="off"
            />
            {errors.email ? (
              <p className="mt-2 text-sm/6 text-red-600">{errors.email}</p>
            ) : (
              <Description>{t('team.emailHint')}</Description>
            )}
          </Field>
          <Field>
            <Label>
              {t('team.phone')} <span className="text-zinc-400">({t('team.optional')})</span>
            </Label>
            <Input
              name="phone"
              type="tel"
              dir="ltr"
              defaultValue={member?.phone ?? ''}
              invalid={!!errors.phone}
              autoComplete="off"
            />
            {errors.phone && <p className="mt-2 text-sm/6 text-red-600">{errors.phone}</p>}
          </Field>
        </div>
        <Field>
          <Label>{t('team.role')}</Label>
          <RadioGroup value={role} onChange={(v) => setRole(v as TeamMemberDto['role'])} className="mt-3">
            {STAFF_ROLES.map((r) => (
              <RadioField key={r}>
                <Radio value={r} color="brand" />
                <Label>{t(`team.roles.${r}`)}</Label>
                <Description>{t(`team.roleHints.${r}`)}</Description>
              </RadioField>
            ))}
          </RadioGroup>
          <Description className="mt-3">{t('team.rolesNote')}</Description>
        </Field>

        {member && !member.isYou && (
          <SwitchField>
            <Label>{t('team.activeLabel')}</Label>
            <Description>{t('team.activeHint')}</Description>
            <Switch color="brand" checked={active} onChange={setActive} />
          </SwitchField>
        )}

        {member && current && current.status !== 'inactive' && (
          <div className="rounded-lg bg-zinc-50 p-4 ring-1 ring-zinc-950/5 dark:bg-white/5 dark:ring-white/10">
            <Button
              outline
              disabled={sendLink.isPending}
              onClick={async () => {
                try {
                  setLink(await sendLink.mutateAsync(member.id))
                } catch {
                  // Shown below.
                }
              }}
            >
              <KeyIcon />
              {current.status === 'invited' ? t('team.sendInvite') : t('team.sendReset')}
            </Button>
            <Text className="mt-2">{t('team.linkHint')}</Text>
          </div>
        )}

        {errorCode(error) ? (
          <p role="alert" className="text-sm/6 font-medium text-red-600 dark:text-red-400">
            {t(`team.errors.${errorCode(error)}`)}
          </p>
        ) : (
          <RequestError error={error} />
        )}
      </FieldGroup>
    </SidePanel>
  )
}
