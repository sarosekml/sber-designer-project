import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Grid, Paper,
} from '@mui/material';

import { Button, Icon, Skeleton, Text } from '@/components/atoms';
import type { IconName } from '@/components/atoms/Icon/Icon.types';
import { BreadCrumbs } from '@/components/molecules';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CheckResult {
  id: string;
  entity: string;
  status: 'passed' | 'failed' | 'warning';
  riskLevel: 'low' | 'medium' | 'high';
  timestamp: string;
}

type ScreenState = 'loading' | 'ready' | 'empty' | 'error';

interface StatusCardData {
  label: string;
  value: number;
  color: string;
  iconName: IconName;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const breadcrumbs = [
  { name: 'Home', route: '/' },
  { name: 'Monitoring', route: '/monitoring' },
  { name: '0075 Recovery Smoke', route: '' },
];

const mockChecks: CheckResult[] = [
  { id: 'CHK-001', entity: 'Risk Engine Service', status: 'passed', riskLevel: 'low', timestamp: '2026-06-07 14:28:03' },
  { id: 'CHK-002', entity: 'AML Data Feed', status: 'passed', riskLevel: 'low', timestamp: '2026-06-07 14:27:55' },
  { id: 'CHK-003', entity: 'Collateral Valuation', status: 'warning', riskLevel: 'medium', timestamp: '2026-06-07 14:27:48' },
  { id: 'CHK-004', entity: 'Credit Limit Check', status: 'passed', riskLevel: 'low', timestamp: '2026-06-07 14:27:40' },
  { id: 'CHK-005', entity: 'Market Data Feed', status: 'failed', riskLevel: 'high', timestamp: '2026-06-07 14:27:32' },
];

const statusCards: StatusCardData[] = [
  { label: 'Total Checks', value: 47, color: '#3B82F6', iconName: 'BarChartSquare' },
  { label: 'Passed', value: 42, color: '#10B981', iconName: 'CheckCircle' },
  { label: 'Failed / Warning', value: 5, color: '#EF4444', iconName: 'AlertTriangle' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusBadgeSx(status: CheckResult['status']) {
  switch (status) {
    case 'passed':
      return { bgcolor: '#D1FAE5', color: '#065F46' };
    case 'failed':
      return { bgcolor: '#FEE2E2', color: '#991B1B' };
    case 'warning':
      return { bgcolor: '#FEF3C7', color: '#92400E' };
  }
}

function riskBadgeSx(level: CheckResult['riskLevel']) {
  switch (level) {
    case 'low':
      return { bgcolor: '#E0E7FF', color: '#3730A3' };
    case 'medium':
      return { bgcolor: '#FEF3C7', color: '#92400E' };
    case 'high':
      return { bgcolor: '#FEE2E2', color: '#991B1B' };
  }
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatusCardView({ card }: { card: StatusCardData }) {
  return (
    <Paper
      elevation={0}
      sx={{
        flex: '1 1 0',
        minWidth: 180,
        p: 2.5,
        borderRadius: 2,
        border: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Grid container alignItems="center" gap={1}>
        <Icon name={card.iconName} size="sm" sx={{ color: card.color, fontSize: 20 }} />
        <Text type="BodyXSReg" color="text.secondary">{card.label}</Text>
      </Grid>
      <Text type="H3StrongSmb" sx={{ color: card.color, mt: 0.5 }}>
        {card.value}
      </Text>
    </Paper>
  );
}

function StatusBadge({ value }: { value: CheckResult['status'] }) {
  const sx = statusBadgeSx(value);
  return (
    <Grid
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.25,
        py: 0.25,
        borderRadius: '12px',
        fontSize: 12,
        lineHeight: '18px',
        fontWeight: 500,
        textTransform: 'capitalize',
        ...sx,
      }}
    >
      <Icon
        name={value === 'passed' ? 'CheckCircle' : value === 'failed' ? 'AlertCircle' : 'AlertTriangle'}
        size="sm"
        sx={{ fontSize: 13 }}
      />
      {value}
    </Grid>
  );
}

function RiskBadge({ value }: { value: CheckResult['riskLevel'] }) {
  const sx = riskBadgeSx(value);
  return (
    <Grid
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: 0.25,
        borderRadius: '12px',
        fontSize: 12,
        lineHeight: '18px',
        fontWeight: 500,
        textTransform: 'capitalize',
        ...sx,
      }}
    >
      {value}
    </Grid>
  );
}

/* ------------------------------------------------------------------ */
/*  Main screen component                                              */
/* ------------------------------------------------------------------ */

export function Screen0075RecoverySmoke() {
  const [screenState] = useState<ScreenState>('ready');

  /* ── Loading state ── */
  if (screenState === 'loading') {
    return (
      <main data-sd-screen-root="true" aria-label="0075 Recovery Smoke" style={{ minHeight: '100vh', background: '#F5F5F5', paddingTop: 24 }}>
        <Grid sx={{ px: 3, mb: 2 }}>
          <Grid sx={{ mb: 1 }}>
            <Skeleton variant="text" width={300} height={20} />
          </Grid>
          <Skeleton variant="text" width={240} height={32} />
          <Grid sx={{ mt: 0.5 }}>
            <Skeleton variant="text" width={180} height={16} />
          </Grid>
        </Grid>
        <Grid container sx={{ px: 3, mb: 3, gap: 2 }}>
          {[1, 2, 3].map((i) => (
            <Grid key={i} sx={{ flex: '1 1 0', minWidth: 180, borderRadius: 2, overflow: 'hidden' }}>
              <Skeleton variant="rectangular" width="100%" height={88} />
            </Grid>
          ))}
        </Grid>
        <Grid sx={{ px: 3 }}>
          <Grid sx={{ borderRadius: 1, overflow: 'hidden' }}>
            <Skeleton variant="rectangular" width="100%" height={320} />
          </Grid>
        </Grid>
      </main>
    );
  }

  /* ── Error state ── */
  if (screenState === 'error') {
    return (
      <main data-sd-screen-root="true" aria-label="0075 Recovery Smoke" style={{ minHeight: '100vh', background: '#F5F5F5' }}>
        <Grid sx={{ px: 3, pt: 3 }}>
          <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={() => {}} />
        </Grid>
        <Grid container direction="column" alignItems="center" justifyContent="center" sx={{ minHeight: '50vh', gap: 2, px: 3 }}>
          <Icon name="AlertCircle" size="lg" sx={{ fontSize: 48, color: '#EF4444' }} />
          <Text type="H4StrongSmb">Failed to load recovery checks</Text>
          <Text type="BodySReg" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 420 }}>
            Could not retrieve recovery smoke test results. The monitoring service may be temporarily unavailable.
          </Text>
          <Button type="accent" onClick={() => window.location.reload()}>Retry</Button>
        </Grid>
      </main>
    );
  }

  /* ── Empty state ── */
  if (screenState === 'empty') {
    return (
      <main data-sd-screen-root="true" aria-label="0075 Recovery Smoke" style={{ minHeight: '100vh', background: '#F5F5F5' }}>
        <Grid sx={{ px: 3, pt: 3 }}>
          <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={() => {}} />
        </Grid>
        <Grid container direction="column" alignItems="center" justifyContent="center" sx={{ minHeight: '50vh', gap: 2, px: 3 }}>
          <Icon name="CheckCircle" size="lg" sx={{ fontSize: 48, color: '#10B981' }} />
          <Text type="H4StrongSmb">No pending checks</Text>
          <Text type="BodySReg" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 400 }}>
            All 0075 recovery smoke checks have passed. No issues detected at this time.
          </Text>
        </Grid>
      </main>
    );
  }

  /* ── Ready state ── */
  return (
    <main data-sd-screen-root="true" aria-label="0075 Recovery Smoke Dashboard" style={{ minHeight: '100vh', background: '#F5F5F5' }}>
      {/* Breadcrumbs */}
      <Grid sx={{ px: 3, pt: 2, pb: 0 }}>
        <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={() => {}} />
      </Grid>

      {/* Page header */}
      <Grid sx={{ px: 3, py: 1.5 }}>
        <Text type="H3StrongSmb">0075 Recovery Smoke</Text>
        <Text type="BodySReg" color="text.secondary" sx={{ mt: 0.25 }}>
          Last full check: 2026-06-07 14:28:03 · Auto-run every 5 min
        </Text>
      </Grid>

      {/* Status cards */}
      <Grid container sx={{ px: 3, mb: 3, gap: 2 }} flexWrap="wrap">
        {statusCards.map((card) => (
          <StatusCardView key={card.label} card={card} />
        ))}
      </Grid>

      {/* Recent checks table */}
      <Grid sx={{ px: 3 }}>
        <Text type="H5StrongSmb" sx={{ mb: 1.5 }}>Recent Checks</Text>
        <TableContainer
          component={Paper}
          sx={{
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            borderRadius: 1,
            overflow: 'auto',
          }}
        >
          <Table sx={{ minWidth: 700, tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                {['Check ID', 'Service / Entity', 'Status', 'Risk Level', 'Timestamp'].map((label) => (
                  <TableCell
                    key={label}
                    sx={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: '#374151',
                      background: '#F9FAFB',
                      borderBottom: '2px solid #E5E7EB',
                      py: 1.5,
                      px: 2,
                    }}
                  >
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {mockChecks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6, color: '#9CA3AF' }}>
                    <Text type="BodySReg" color="text.secondary">No check results recorded</Text>
                  </TableCell>
                </TableRow>
              ) : (
                mockChecks.map((row) => (
                  <TableRow
                    key={row.id}
                    sx={{ '&:hover': { background: '#F9FAFB' }, '&:not(:last-child) .MuiTableCell-body': { borderBottom: '1px solid #F3F4F6' } }}
                  >
                    <TableCell sx={{ px: 2, py: 1.5, fontSize: 13, fontFamily: 'monospace', color: '#1F2937', fontWeight: 500 }}>
                      {row.id}
                    </TableCell>
                    <TableCell sx={{ px: 2, py: 1.5, fontSize: 13, color: '#1F2937' }}>
                      {row.entity}
                    </TableCell>
                    <TableCell sx={{ px: 2, py: 1.5 }}>
                      <StatusBadge value={row.status} />
                    </TableCell>
                    <TableCell sx={{ px: 2, py: 1.5 }}>
                      <RiskBadge value={row.riskLevel} />
                    </TableCell>
                    <TableCell sx={{ px: 2, py: 1.5, fontSize: 13, color: '#6B7280' }}>
                      {row.timestamp}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>
    </main>
  );
}
