import * as React from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto table-responsive rounded-md border border-white-light bg-white dark:border-[#1b2e4b] dark:bg-black shadow-sm">
    <table
      ref={ref}
      className={cn("w-full table-hover text-sm border-collapse", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("bg-white-light/30 dark:bg-[#1a2941]/50 border-b border-white-light dark:border-[#1b2e4b]", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-white-light bg-white-light/30 dark:bg-[#1a2941]/50 dark:border-[#1b2e4b] font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  Omit<React.ComponentPropsWithoutRef<typeof motion.tr>, "children"> & { children?: React.ReactNode }
>(({ className, ...props }, ref) => (
  <motion.tr
    ref={ref}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ backgroundColor: "rgba(67, 97, 238, 0.05)" }}
    className={cn(
      "border-b border-white-light/40 dark:border-[#191e3a] transition-colors",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & { sortable?: boolean; isSorted?: 'asc' | 'desc' | null }
>(({ className, sortable, isSorted, children, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-semibold text-text-muted uppercase tracking-wider text-[10px] [&:has([role=checkbox])]:pr-0",
      sortable && "cursor-pointer hover:text-text-primary transition-colors select-none",
      className
    )}
    {...props}
  >
    <div className="flex items-center gap-1.5">
      {children}
      {sortable && (
        <div className="flex flex-col">
          <ChevronUp className={cn("w-3 h-3 -mb-1", isSorted === 'asc' ? "text-primary" : "opacity-30")} />
          <ChevronDown className={cn("w-3 h-3", isSorted === 'desc' ? "text-primary" : "opacity-30")} />
        </div>
      )}
    </div>
  </th>
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle text-text-secondary dark:text-white-dark font-medium [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-text-muted", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
