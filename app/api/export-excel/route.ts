import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import ExcelJS from "exceljs";
import { getRequiredSession, isAdmin } from "@/lib/api-middleware";
import { badRequestResponse, forbiddenResponse, handleError } from "@/lib/api-responses";
import { auditAdmin } from "@/lib/audit-log";
import { getBranding } from "@/lib/branding";

const exportSchema = z.object({
  userIds: z.array(z.string()),
  month: z.string().regex(/^\d{4}-\d{2}$/), // Format: YYYY-MM
});

export async function POST(request: Request) {
  const session = await getRequiredSession();

  const body = await request.json();
  const parsed = exportSchema.safeParse(body);

  if (!parsed.success) {
    return badRequestResponse("Invalid payload");
  }

  const { userIds, month } = parsed.data;

  // Check permissions: admin can export any users, employees can only export themselves
  if (!isAdmin(session)) {
    if (userIds.length !== 1 || userIds[0] !== session.user.id) {
      return forbiddenResponse("Unauthorized");
    }
  }
  const [year, monthNum] = month.split("-");
  const startDate = new Date(`${year}-${monthNum}-01T00:00:00.000Z`);
  const endDate = new Date(Date.UTC(parseInt(year), parseInt(monthNum), 0, 23, 59, 59, 999)); // Last day of month, UTC end of day

  try {
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = getBranding().app.name;
    workbook.created = new Date();

    // Batch fetch all users and entries in parallel to avoid N+1 queries
    // Select only the fields we need to reduce memory usage
    const [users, allEntries] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          email: true,
        },
      }),
      prisma.timeEntry.findMany({
        where: {
          userId: { in: userIds },
          workDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          userId: true,
          workDate: true,
          hoursWorked: true,
          overtimeHours: true,
          permessoHours: true,
          sicknessHours: true,
          vacationHours: true,
          permesso104Hours: true,
          paternityHours: true,
          morningStart: true,
          morningEnd: true,
          afternoonStart: true,
          afternoonEnd: true,
          medicalCertificate: true,
          notes: true,
        },
        orderBy: { workDate: "asc" },
      }),
    ]);

    // Create a map of userId to user for O(1) lookup
    const userMap = new Map(users.map(user => [user.id, user]));
    
    // Group entries by userId for O(1) lookup
    const entriesByUser = new Map<string, typeof allEntries>();
    for (const entry of allEntries) {
      if (!entriesByUser.has(entry.userId)) {
        entriesByUser.set(entry.userId, []);
      }
      entriesByUser.get(entry.userId)!.push(entry);
    }

    // Add summary sheet if multiple users are selected
    if (userIds.length > 1) {
      const summarySheet = workbook.addWorksheet("Riepilogo");

      // Set columns
      summarySheet.columns = [
        { key: "name", width: 30 },
        { key: "hoursWorked", width: 15 },
        { key: "overtime", width: 15 },
        { key: "permFerieHours", width: 15 },
        { key: "sicknessHours", width: 15 },
        { key: "permesso104Hours", width: 15 },
        { key: "paternityHours", width: 15 },
        { key: "totalHours", width: 15 },
      ];

      // Format month for title (Italian)
      const [y, m] = month.split("-");
      const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
      const monthName = dateObj.toLocaleString("it-IT", { month: "long" });
      const capitalizedMonth =
        monthName.charAt(0).toUpperCase() + monthName.slice(1);

      const titleRow = summarySheet.addRow([
        `Riepilogo Ore - ${capitalizedMonth} ${y}`,
      ]);
      titleRow.font = { size: 16, bold: true };
      summarySheet.mergeCells("A1:H1");
      titleRow.alignment = { horizontal: "center", vertical: "middle" };
      titleRow.height = 30;

      // Header
      const headerRow = summarySheet.addRow([
        "Dipendente",
        "Ore Ordinarie",
        "Straordinario",
        "Ore Perm/Ferie",
        "Ore Malattia",
        "Ore L.104",
        "Ore Paternità",
        "Totale Ore",
      ]);

      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };
      headerRow.height = 20;

      for (let i = 1; i <= 8; i++) {
        headerRow.getCell(i).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4472C4" },
        };
      }

      // Data rows
      for (const userId of userIds) {
        const user = userMap.get(userId);
        if (!user) continue;

        const entries = entriesByUser.get(userId) || [];

        let totalHoursWorked = 0;
        let totalOvertime = 0;
        let totalPermFerie = 0;
        let totalSickness = 0;
        let totalPermesso104 = 0;
        let totalPaternity = 0;

        entries.forEach((entry) => {
          const hoursWorked = entry.hoursWorked;
          const overtime = entry.overtimeHours;
          const permessoHours = entry.permessoHours;
          const vacationHours = entry.vacationHours;
          const sicknessHours = entry.sicknessHours;
          const permesso104Hours = entry.permesso104Hours;
          const paternityHours = entry.paternityHours;

          totalHoursWorked += hoursWorked;
          totalOvertime += overtime;
          totalPermFerie += permessoHours + vacationHours;
          totalSickness += sicknessHours;
          totalPermesso104 += permesso104Hours;
          totalPaternity += paternityHours;
        });

        const row = summarySheet.addRow({
          name: user.name || user.email,
          hoursWorked: totalHoursWorked,
          overtime: totalOvertime,
          permFerieHours: totalPermFerie,
          sicknessHours: totalSickness,
          permesso104Hours: totalPermesso104,
          paternityHours: totalPaternity,
          totalHours: totalHoursWorked + totalOvertime,
        });

        // Formatting
        row.getCell(2).numFmt = "0.00";
        row.getCell(3).numFmt = "0.00";
        row.getCell(4).numFmt = "0.00";
        row.getCell(5).numFmt = "0.00";
        row.getCell(6).numFmt = "0.00";
        row.getCell(7).numFmt = "0.00";
        row.getCell(8).numFmt = "0.00";
      }

      // Add borders
      summarySheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };
          });
        }
      });
    }

    // Function to add a worksheet for a user
    const addUserSheet = (userId: string) => {
      const user = userMap.get(userId);
      if (!user) throw new Error("User not found");

      const entries = entriesByUser.get(userId) || [];

      // Check if this specific user has any medical certificates in this month
      const includeMedicalCertificate = entries.some(
        (e) => e.medicalCertificate !== null && e.medicalCertificate !== ""
      );

      // Create worksheet with user name
      const sheetName = (user.name || user.email).replace(/[^a-z0-9 ]/gi, "_").substring(0, 31);
      const worksheet = workbook.addWorksheet(sheetName);

      // Set column widths
      const columns = [
        { key: "date", width: 12 },
        { key: "morningStart", width: 14 },
        { key: "morningEnd", width: 14 },
        { key: "afternoonStart", width: 16 },
        { key: "afternoonEnd", width: 16 },
        { key: "hoursWorked", width: 14 },
        { key: "overtime", width: 12 },
        { key: "permFerieHours", width: 15 },
        { key: "sicknessHours", width: 15 },
        { key: "permesso104Hours", width: 15 },
        { key: "paternityHours", width: 15 },
        { key: "totalHours", width: 12 },
      ];

      if (includeMedicalCertificate) {
        columns.push({ key: "certificatoMedico", width: 18 });
      }

      columns.push({ key: "notes", width: 40 });
      worksheet.columns = columns;

      // Format month for title (Italian)
      const [y, m] = month.split("-");
      const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
      const monthName = dateObj.toLocaleString("it-IT", { month: "long" });
      const capitalizedMonth =
        monthName.charAt(0).toUpperCase() + monthName.slice(1);

      // Add title row
      const titleRow = worksheet.addRow([
        `Presenze - ${user.name || user.email} - ${capitalizedMonth} ${y}`,
      ]);
      titleRow.font = { size: 14, bold: true };
      const lastColumn = includeMedicalCertificate ? "M" : "L";
      worksheet.mergeCells(`A1:${lastColumn}1`);
      titleRow.alignment = { horizontal: "left", vertical: "middle" };
      titleRow.height = 25;

      // Add header row
      const headerColumns = [
        "Data",
        "Inizio Mattina",
        "Fine Mattina",
        "Inizio Pomeriggio",
        "Fine Pomeriggio",
        "Ore Ordinarie",
        "Straordinario",
        "Ore Perm/Ferie",
        "Ore Malattia",
        "Ore 104",
        "Ore Paternità",
        "Totale Ore",
      ];

      if (includeMedicalCertificate) {
        headerColumns.push("Certificato Medico");
      }

      headerColumns.push("Note");

      const headerRow = worksheet.addRow(headerColumns);

      // Style header row
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };
      headerRow.height = 20;
      for (let i = 1; i <= columns.length; i++) {
        headerRow.getCell(i).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4472C4" },
        };
      }

      // Add data rows
      let totalHoursSum = 0;
      let totalOvertimeSum = 0;
      let totalPermFerieSum = 0;
      let totalSicknessSum = 0;
      let totalPermesso104Sum = 0;
      let totalPaternitySum = 0;

      entries.forEach((entry) => {
        const hoursWorked = entry.hoursWorked;
        const overtime = entry.overtimeHours;
        const permessoHours = entry.permessoHours;
        const sicknessHours = entry.sicknessHours;
        const vacationHours = entry.vacationHours;
        const permesso104Hours = entry.permesso104Hours;
        const paternityHours = entry.paternityHours;
        const permFerieHours = permessoHours + vacationHours;
        const totalHours = hoursWorked + overtime;

        // Extract medical certificate from the dedicated field
        const certificatoMedico = entry.medicalCertificate || "";

        totalHoursSum += hoursWorked;
        totalOvertimeSum += overtime;
        totalPermFerieSum += permFerieHours;
        totalSicknessSum += sicknessHours;
        totalPermesso104Sum += permesso104Hours;
        totalPaternitySum += paternityHours;

        // Helper to remove "PERM" from time fields
        const cleanTimeValue = (val: string | null) => (val === "PERM" ? "" : val || "");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rowData: Record<string, any> = {
          date: entry.workDate,
          morningStart: cleanTimeValue(entry.morningStart),
          morningEnd: cleanTimeValue(entry.morningEnd),
          afternoonStart: cleanTimeValue(entry.afternoonStart),
          afternoonEnd: cleanTimeValue(entry.afternoonEnd),
          hoursWorked: hoursWorked,
          overtime: overtime,
          permFerieHours: permFerieHours,
          sicknessHours: sicknessHours,
          permesso104Hours: permesso104Hours,
          paternityHours: paternityHours,
          totalHours: totalHours,
        };

        if (includeMedicalCertificate) {
          rowData.certificatoMedico = certificatoMedico;
        }

        rowData.notes = entry.notes || "";

        const row = worksheet.addRow(rowData);

        // Set formula for Total Hours (Column L / 12) = F + G
        row.getCell(12).value = {
          formula: `F${row.number}+G${row.number}`,
          result: totalHours,
        };

        // Format date cell
        row.getCell(1).numFmt = "dd/mm/yyyy";

        // Format number cells (2 decimals)
        row.getCell(6).numFmt = "0.00"; // Hours Worked
        row.getCell(7).numFmt = "0.00"; // Overtime
        row.getCell(8).numFmt = "0.00"; // Perm/Ferie Hours
        row.getCell(9).numFmt = "0.00"; // Sickness Hours
        row.getCell(10).numFmt = "0.00"; // Permesso 104 Hours
        row.getCell(11).numFmt = "0.00"; // Paternity Hours
        row.getCell(12).numFmt = "0.00"; // Total Hours

        // Alternate row colors
        if (worksheet.rowCount % 2 === 0) {
          for (let i = 1; i <= columns.length; i++) {
            row.getCell(i).fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF2F2F2" },
            };
          }
        }
      });

      const lastDataRow = worksheet.rowCount;
      const firstDataRow = 3;

      // Add empty row
      worksheet.addRow([]);

      // Add summary row
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const summaryColumns: any[] = [
        "TOTALE",
        "",
        "",
        "",
        "",
        { formula: `SUM(F${firstDataRow}:F${lastDataRow})`, result: totalHoursSum },
        { formula: `SUM(G${firstDataRow}:G${lastDataRow})`, result: totalOvertimeSum },
        { formula: `SUM(H${firstDataRow}:H${lastDataRow})`, result: totalPermFerieSum },
        { formula: `SUM(I${firstDataRow}:I${lastDataRow})`, result: totalSicknessSum },
        { formula: `SUM(J${firstDataRow}:J${lastDataRow})`, result: totalPermesso104Sum },
        { formula: `SUM(K${firstDataRow}:K${lastDataRow})`, result: totalPaternitySum },
        { formula: `SUM(L${firstDataRow}:L${lastDataRow})`, result: totalHoursSum + totalOvertimeSum },
      ];

      if (includeMedicalCertificate) {
        summaryColumns.push("");
      }

      summaryColumns.push("");

      const summaryRow = worksheet.addRow(summaryColumns);

      summaryRow.font = { bold: true, size: 12 };
      for (let i = 1; i <= columns.length; i++) {
        summaryRow.getCell(i).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFD966" },
        };
      }

      // Format summary numbers
      summaryRow.getCell(6).numFmt = "0.00";
      summaryRow.getCell(7).numFmt = "0.00";
      summaryRow.getCell(8).numFmt = "0.00";
      summaryRow.getCell(9).numFmt = "0.00";
      summaryRow.getCell(10).numFmt = "0.00";
      summaryRow.getCell(11).numFmt = "0.00";
      summaryRow.getCell(12).numFmt = "0.00";

      // Add borders to all cells
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };
          });
        }
      });

      // Center align time cells
      worksheet.getColumn(2).alignment = { horizontal: "center" };
      worksheet.getColumn(3).alignment = { horizontal: "center" };
      worksheet.getColumn(4).alignment = { horizontal: "center" };
      worksheet.getColumn(5).alignment = { horizontal: "center" };

      // Right align number cells
      worksheet.getColumn(6).alignment = { horizontal: "right" };
      worksheet.getColumn(7).alignment = { horizontal: "right" };
      worksheet.getColumn(8).alignment = { horizontal: "right" };
      worksheet.getColumn(9).alignment = { horizontal: "right" };
      worksheet.getColumn(10).alignment = { horizontal: "right" };
      worksheet.getColumn(11).alignment = { horizontal: "right" };
      worksheet.getColumn(12).alignment = { horizontal: "right" };
      worksheet.getColumn(9).alignment = { horizontal: "right" };
      worksheet.getColumn(10).alignment = { horizontal: "right" };
      worksheet.getColumn(11).alignment = { horizontal: "right" };
    };

    // Add a sheet for each user
    for (const userId of userIds) {
      addUserSheet(userId);
    }

    // Generate Excel file buffer
    const buffer = await workbook.xlsx.writeBuffer();

    await auditAdmin.excelExported(session.user.id);

    // Return the Excel file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="hours_export_${month}.xlsx"`,
      },
    });
  } catch (error) {
    return handleError(error, "exporting data");
  }
}
