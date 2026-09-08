import { Component, OnInit,inject, signal,computed} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Worker } from '../../../models/worker.model';
import { WorkerCycleHistory } from '../../../models/worker-cycle-history.model';
import { CommonModule } from '@angular/common';
import { WorkersService } from '../../../shared/workers/workers.service';

@Component({
    selector: 'app-worker-history',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './worker-history.html',
    styleUrl: './worker-history.css'
})
export class WorkerHistoryComponent implements OnInit {

    // ============================================
    // ✅ Services
    // ============================================

    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly workersService = inject(WorkersService);


    // ============================================
    // ✅ Worker
    // ============================================

    worker = signal<Worker | null>(null);


    // ============================================
    // ✅ Cycles
    // ============================================

    cycles = signal<WorkerCycleHistory[]>([]);


    // ============================================
    // ✅ UI State
    // ============================================

    loading = signal(false);

    error = signal<string | null>(null);


    // ============================================
    // ✅ Expanded Cycle
    // ============================================

    expandedCycleId = signal<number | null>(null);


    // ============================================
    // ✅ Statistics
    // ============================================

    totalCycles = computed(() => {

        return this.cycles().length;

    });


    // ============================================
    // ✅ Total Pieces
    // ============================================

    totalPieces = computed(() => {

        return this.cycles().reduce(
            (total, cycle) => {

                return total +
                    cycle.productions.reduce(
                        (sum, production) =>
                            sum + production.quantity,
                        0
                    );

            },
            0
        );

    });


    // ============================================
    // ✅ Total Earned / Salary
    // ============================================

    totalEarned = computed(() => {

        return this.cycles().reduce(
            (total, cycle) =>
                total +
                (cycle.balance.totalProduction ?? 0),
            0
        );

    });


    // ============================================
    // ✅ Total Paid
    // ============================================

    totalPaid = computed(() => {

        return this.cycles().reduce(
            (total, cycle) =>
                total +
                cycle.balance.totalPayments,
            0
        );

    });


    // ============================================
    // ✅ Total Remaining
    // ============================================

    totalRemaining = computed(() => {

        return this.cycles().reduce(
            (total, cycle) =>
                total +
                cycle.balance.remaining,
            0
        );

    });


    // ============================================
    // ✅ Worker Type
    // ============================================

    isPieceWorker = computed(() => {

        return this.worker()?.paymentType === 'piece';

    });


    isTailorWorker = computed(() => {

        return this.worker()?.paymentType === 'tailor';

    });


    isMonthlyWorker = computed(() => {

        return this.worker()?.paymentType === 'monthly';

    });


    // ============================================
    // ✅ Initialize
    // ============================================

    ngOnInit(): void {

        const workerId = Number(
            this.route.snapshot.paramMap.get('id')
        );

        if (!workerId) {

            this.error.set('Invalid worker ID.');

            return;

        }

        this.loadWorker(workerId);

        this.loadWorkerCycles(workerId);

    }


    // ============================================
    // ✅ Load Worker
    // ============================================

    loadWorker(workerId: number): void {

        this.workersService
            .getWorkerById(workerId)
            .subscribe({

                next: (worker) => {

                    this.worker.set(worker);

                },

                error: (err) => {

                    console.error(
                        'Failed to load worker:',
                        err
                    );

                    this.error.set(
                        'Failed to load worker.'
                    );

                }

            });

    }


    // ============================================
    // ✅ Load Worker Cycles
    // ============================================

    loadWorkerCycles(workerId: number): void {

        this.loading.set(true);

        this.error.set(null);

        this.workersService
            .getWorkerCyclesHistory(workerId)
            .subscribe({

                next: (cycles) => {

                    this.cycles.set(cycles);

                    this.loading.set(false);

                },

                error: (err) => {

                    console.error(
                        'Failed to load worker cycles:',
                        err
                    );

                    this.error.set(
                        'Failed to load worker cycle history.'
                    );

                    this.loading.set(false);

                }

            });

    }


    // ============================================
    // ✅ Toggle Cycle
    // ============================================

    toggleCycle(cycleId: number): void {

        if (this.expandedCycleId() === cycleId) {

            this.expandedCycleId.set(null);

        } else {

            this.expandedCycleId.set(cycleId);

        }

    }


    // ============================================
    // ✅ Check Expanded
    // ============================================

    isCycleExpanded(cycleId: number): boolean {

        return this.expandedCycleId() === cycleId;

    }


  
  // ============================================
  // ✅ Go Back
  // ============================================
  goBack(): void {
    history.back();
  }

  // ============================================
  // ✅ Print Cycle
  // ============================================
  printCycle(cycles: WorkerCycleHistory): void {
   
  // ============================================
  // 1. Get current data
  // ============================================
  const worker = this.worker();
  const cycle = this.cycles();
  const productions = this.cycles().find(c => c.id === cycles.id)?.productions || [];
  const payments = this.cycles().find(c => c.id === cycles.id)?.payments || [];

  // ============================================
  // 2. Validate data
  // ============================================
  if (!worker) {
    console.error('No worker data available');
    return;
  }

  if (!cycle) {
    console.error('No current cycle available');
    return;
  }

  // ============================================
  // 3. Calculate totals
  // ============================================
  const totalProduction = productions.reduce((sum, p) => sum + (p.total || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = totalProduction - totalPaid;
  const debt = this.cycles().find(c => c.id === cycles.id)?.balance.remaining || 0;

  // ============================================
  // 4. Build statement HTML
  // ============================================
  const cycleName = `Cycle ${cycles.id}`;
  const cycleDate = cycles.openedAt
    ? new Date(cycles.openedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : '';

  const productionCount = productions.length;
  const paymentCount = payments.length;

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="ltr" lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Worker Statement - ${worker.name}</title>
      <style>
        /* ============================================
           Reset & Base Styles
           ============================================ */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          padding: 24px;
          background: #ffffff;
          color: #1a1a2e;
          line-height: 1.6;
          max-width: 1100px;
          margin: 0 auto;
        }

        /* ============================================
           Print Styles
           ============================================ */
        @media print {
          body {
            padding: 16px;
            font-size: 11px;
          }
          
          .no-print {
            display: none !important;
          }
          
          table {
            font-size: 11px;
          }
          
          .header {
            border-bottom-width: 2px;
            margin-bottom: 16px;
          }
          
          .info-section {
            padding: 10px;
            margin-bottom: 16px;
          }
          
          .summary-section {
            padding: 10px;
          }
          
          .footer {
            margin-top: 24px;
            padding-top: 12px;
          }
        }

        /* ============================================
           Header
           ============================================ */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 4px solid #2563eb;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }

        .logo {
          flex-shrink: 0;
        }

        .logo img {
          height: 60px;
          width: auto;
        }

        .title {
          text-align: center;
          flex: 1;
        }

        .title h1 {
          font-size: 26px;
          color: #0f172a;
          margin-bottom: 4px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .title h2 {
          font-size: 20px;
          color: #334155;
          font-weight: 500;
        }

        .title .subtitle {
          font-size: 14px;
          color: #64748b;
          font-weight: 400;
          margin-top: 2px;
        }

        /* ============================================
           Info Section
           ============================================ */
        .info-section {
          background: #f8fafc;
          border-radius: 10px;
          padding: 18px 20px;
          margin-bottom: 24px;
          border: 1px solid #e2e8f0;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 8px 24px;
        }

        .info-item {
          display: flex;
          align-items: center;
          padding: 4px 0;
        }

        .info-item .label {
          font-weight: 600;
          color: #475569;
          margin-right: 8px;
          font-size: 13px;
          min-width: 80px;
        }

        .info-item .value {
          color: #0f172a;
          font-weight: 500;
          font-size: 13px;
        }

        .info-item .badge {
          display: inline-block;
          padding: 2px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .badge-open {
          background: #dcfce7;
          color: #16a34a;
        }

        .badge-closed {
          background: #fee2e2;
          color: #dc2626;
        }

        /* ============================================
           Table Section
           ============================================ */
        .table-section {
          margin-bottom: 24px;
        }

        .table-section .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 6px;
          border-bottom: 2px solid #e2e8f0;
        }

        .table-section h3 {
          font-size: 17px;
          color: #0f172a;
          font-weight: 600;
        }

        .table-section .count-badge {
          background: #e2e8f0;
          padding: 2px 12px;
          border-radius: 20px;
          font-size: 13px;
          color: #475569;
          font-weight: 500;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        table thead th {
          background: #f1f5f9;
          color: #334155;
          font-weight: 600;
          padding: 10px 14px;
          text-align: left;
          border: 1px solid #e2e8f0;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        table tbody td {
          padding: 9px 14px;
          border: 1px solid #e2e8f0;
          color: #1e293b;
        }

        table tbody tr:nth-child(even) {
          background: #fafbfc;
        }

        table tbody tr:hover {
          background: #f1f5f9;
        }

        .total-row td {
          background: #f1f5f9;
          font-weight: 700;
          color: #0f172a;
          border-top: 2px solid #94a3b8;
        }

        .text-center {
          text-align: center;
          color: #94a3b8;
          font-style: italic;
          padding: 20px !important;
        }

        .text-right {
          text-align: right;
        }

        .text-muted {
          color: #94a3b8;
          font-size: 12px;
        }

        /* ============================================
           Monthly Salary Section
           ============================================ */
        .monthly-salary-section {
          background: #f8fafc;
          border-radius: 10px;
          padding: 18px 20px;
          margin-bottom: 24px;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .monthly-salary-section .label {
          font-weight: 600;
          color: #475569;
          font-size: 15px;
        }

        .monthly-salary-section .value {
          font-weight: 700;
          color: #0f172a;
          font-size: 18px;
        }

        /* ============================================
           Summary Section
           ============================================ */
        .summary-section {
          background: #f1f5f9;
          border-radius: 10px;
          padding: 18px 20px;
          margin-top: 8px;
          border: 1px solid #e2e8f0;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
        }

        .summary-item .label {
          font-weight: 500;
          color: #475569;
          font-size: 14px;
        }

        .summary-item .value {
          font-weight: 700;
          color: #0f172a;
          font-size: 16px;
        }

        .summary-item.positive .value {
          color: #16a34a;
        }

        .summary-item.negative .value {
          color: #dc2626;
        }

        .summary-item.neutral .value {
          color: #2563eb;
        }

        .summary-item .status-icon {
          font-size: 18px;
          margin-right: 6px;
        }

        /* ============================================
           Footer
           ============================================ */
        .footer {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 2px solid #e2e8f0;
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer .print-time {
          color: #94a3b8;
        }

        .footer .page-info {
          color: #94a3b8;
        }

        /* ============================================
           Utility Classes
           ============================================ */
        .mt-1 { margin-top: 8px; }
        .mb-1 { margin-bottom: 8px; }
        .fw-600 { font-weight: 600; }
        .fs-12 { font-size: 12px; }
        .color-slate { color: #64748b; }
      </style>
    </head>
    <body>
      <!-- ==========================================
           HEADER
           ========================================== -->
      <div class="header">
        <div class="logo">
          <img src="assets/logo.png" alt="Workshop Logo" height="60">
        </div>
        <div class="title">
          <h1>Worker Statement</h1>
          <h2>${worker.name}</h2>
          <div class="subtitle">Account Statement &amp; Balance Summary</div>
        </div>
      </div>

      <!-- ==========================================
           WORKER & CYCLE INFORMATION
           ========================================== -->
      <div class="info-section">
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Worker:</span>
            <span class="value">${worker.name}</span>
          </div>
          <div class="info-item">
            <span class="label">Phone:</span>
            <span class="value">${worker.phone || 'Not registered'}</span>
          </div>
          <div class="info-item">
            <span class="label">Payment Type:</span>
            <span class="value">${worker.paymentType === 'piece' ? 'Piecework' : worker.paymentType === 'tailor' ? 'Tailor' : 'Monthly'}</span>
          </div>
          <div class="info-item">
            <span class="label">Cycle:</span>
            <span class="value">${cycleName}</span>
          </div>
          ${cycleDate ? `
          <div class="info-item">
            <span class="label">Cycle Date:</span>
            <span class="value">${cycleDate}</span>
          </div>
          ` : ''}
          <div class="info-item">
            <span class="label">Status:</span>
            <span class="value">
              <span class="badge ${cycles.status === 'open' ? 'badge-open' : 'badge-closed'}">
                ${cycles.status === 'open' ? '● Open' : '● Closed'}
              </span>
            </span>
          </div>
        </div>
      </div>

      <!-- ==========================================
           PRODUCTION TABLE (for piecework & tailor)
           ========================================== -->
      ${worker.paymentType !== 'monthly' ? `
      <div class="table-section">
        <div class="section-header">
          <h3>Production</h3>
          <span class="count-badge">${productionCount} items</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Work Type</th>
              <th class="text-right">Quantity</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Total</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${productions.length > 0 ? productions.map((p, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${p.workTypeName || 'Not specified'}</td>
                <td class="text-right">${p.quantity || 0}</td>
                <td class="text-right">${p.price || 0} USD</td>
                <td class="text-right">${p.total || 0} USD</td>
                <td>${p.productionDate ? new Date(p.productionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="6" class="text-center">No production records found</td>
              </tr>
            `}
            <tr class="total-row">
              <td colspan="4"><strong>Total Production</strong></td>
              <td class="text-right"><strong>${totalProduction} USD</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : `
      <!-- ==========================================
           MONTHLY SALARY
           ========================================== -->
      <div class="monthly-salary-section">
        <span class="label">Monthly Salary:</span>
        <span class="value">${worker.monthlySalary || 0} USD</span>
      </div>
      `}

      <!-- ==========================================
           PAYMENTS TABLE
           ========================================== -->
      <div class="table-section">
        <div class="section-header">
          <h3>Payments</h3>
          <span class="count-badge">${paymentCount} payments</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th class="text-right">Amount</th>
              <th>Type</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${payments.length > 0 ? payments.map((p, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${p.transactionDate ? new Date(p.transactionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not specified'}</td>
                <td class="text-right">${p.amount} USD</td>
                <td>${p.type === 'salary' ? 'Salary' : p.type === 'advance' ? 'Advance' : 'Other'}</td>
                <td>${p.note || '-'}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="5" class="text-center">No payment records found</td>
              </tr>
            `}
            <tr class="total-row">
              <td colspan="2"><strong>Total Payments</strong></td>
              <td class="text-right"><strong>${totalPaid} USD</strong></td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ==========================================
           SUMMARY
           ========================================== -->
      <div class="summary-section">
        <div class="summary-grid">
         ${worker.paymentType !== 'monthly' ? `
    <div class="summary-item neutral">
      <span class="label">Total Production</span>
      <span class="value">${totalProduction} USD</span>
    </div>
  ` : ''}
          <div class="summary-item neutral">
            <span class="label">Total Payments</span>
            <span class="value">${totalPaid} USD</span>
          </div>
          <div class="summary-item ${debt > 0 ? 'negative' : debt < 0 ? 'positive' : 'neutral'}">
            <span class="label">Total Due</span>
            <span class="value">${debt} USD</span>
          </div>
          <div class="summary-item ${balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral'}">
            <span class="label">Balance</span>
            <span class="value">${balance} USD</span>
          </div>
          <div class="summary-item ${balance === 0 ? 'positive' : 'neutral'}">
            <span class="label">Account Status</span>
            <span class="value">
              ${balance === 0 ? '✅ Settled' : balance > 0 ? '⚠️ Due' : '🔴 Overdue'}
            </span>
          </div>
        </div>
      </div>

      <!-- ==========================================
           FOOTER
           ========================================== -->
      <div class="footer">
        <span class="print-time">Printed: ${new Date().toLocaleString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</span>
        <span class="page-info">Worker Statement &bull; ${worker.name}</span>
      </div>
    </body>
    </html>
  `;

  // ============================================
  // 5. Open print window
  // ============================================
  const printWindow = window.open('', '_blank', 'width=1100,height=900,scrollbars=yes');

  if (!printWindow) {
    console.error('Failed to open print window');
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  printWindow.onload = function() {
    printWindow.focus();
    
    // Small delay to ensure styles are applied
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

}
// ============================================
// ✅ Share Cycle
// ============================================

async shareCycle(cycle: WorkerCycleHistory): Promise<void> {

    const workerName = this.worker()?.name ?? 'Worker';

    const text = `
Worker: ${workerName}
Cycle #${cycle.id}

Total: ${cycle.balance.totalProduction ?? 0} DA
Paid: ${cycle.balance.totalPayments} DA
Remaining: ${cycle.balance.remaining} DA
    `.trim();

    if (navigator.share) {

        try {
            await navigator.share({
                title: `Worker Cycle #${cycle.id}`,
                text
            });

        } catch (error) {
            console.log('Share cancelled:', error);
        }

    } else {

        await navigator.clipboard.writeText(text);

        alert('Cycle information copied to clipboard.');

    }
}

  getAvatarColor(name: string): string {
    const colors = [
      'linear-gradient(135deg, #4F46E5, #7C3AED)',
      'linear-gradient(135deg, #EC4899, #F43F5E)',
      'linear-gradient(135deg, #10B981, #059669)',
      'linear-gradient(135deg, #F59E0B, #D97706)',
      'linear-gradient(135deg, #3B82F6, #2563EB)',
      'linear-gradient(135deg, #8B5CF6, #6D28D9)',
    ];
    
    if (!name) return colors[0];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }


}