import { Subscription } from "rxjs";
import { Store } from "../Store";
import { Table } from "../store/Table";
import { Logger } from "../Logger";
import { FocusColumn, FocusColumnModel } from "./FocusColumnModel";
import {
  FocusMoveTable,
  FocusTargetTable,
  FocusTargetColumn,
} from "../command/editor";
import {
  focusEnd,
  focusEndColumn,
  selectEndColumn,
} from "../helper/FocusTableHelper";
import { getData, getIndex, range } from "../Helper";

export type FocusType =
  | "tableName"
  | "tableComment"
  | "columnName"
  | "columnDataType"
  | "columnNotNull"
  | "columnDefault"
  | "columnComment";

interface FocusData {
  focusTargetTable?: FocusTargetTable;
  focusTargetColumn?: FocusTargetColumn;
}

export interface FocusTable {
  readonly id: string;
  readonly currentFocus: FocusType;
  readonly currentFocusId: string;
  focusName: boolean;
  focusComment: boolean;
  focusColumns: FocusColumn[];

  focusColumnChangeCall: boolean;
  move(focusMoveTable: FocusMoveTable): void;
  focus(focusData: FocusData): void;
  destroy(): void;
}

export class FocusTableModel implements FocusTable {
  focusName = true;
  focusComment = false;
  focusColumns: FocusColumn[] = [];
  focusColumnChangeCall = true;
  private table: Table;
  private store: Store;
  private currentFocusColumn: FocusColumn | null = null;
  private subscriptionList: Subscription[] = [];

  get id() {
    return this.table.id;
  }

  get currentFocus(): FocusType {
    if (this.currentFocusColumn?.currentFocus) {
      return this.currentFocusColumn.currentFocus;
    } else if (this.focusComment) {
      return "tableComment";
    }
    return "tableName";
  }

  get currentFocusId(): string {
    if (this.currentFocusColumn === null) {
      return this.id;
    } else {
      return this.currentFocusColumn.id;
    }
  }

  constructor(table: Table, store: Store) {
    const { show } = store.canvasState;
    this.table = table;
    this.store = store;
    this.table.columns.forEach(column => {
      this.focusColumns.push(new FocusColumnModel(column, show));
    });
    this.subscriptionList.push(
      store.observe(this.table.columns, () => {
        this.createFocusColumns();
      })
    );
  }

  move(focusMoveTable: FocusMoveTable) {
    const { show } = this.store.canvasState;
    if (!focusMoveTable.shiftKey) {
      selectEndColumn(this.focusColumns);
    }
    switch (focusMoveTable.moveKey) {
      case "ArrowUp":
        if (this.focusColumns.length !== 0) {
          if (this.currentFocusColumn === null) {
            // move table -> column
            focusEnd(this);
            this.currentFocusColumn = this.focusColumns[
              this.focusColumns.length - 1
            ];
            this.currentFocusColumn.selected = true;
            this.currentFocusColumn.focusName = true;
          } else {
            const index = getIndex(
              this.focusColumns,
              this.currentFocusColumn.id
            );
            if (index !== null) {
              if (index === 0) {
                // move column -> table
                focusEnd(this);
                selectEndColumn(this.focusColumns);
                this.currentFocusColumn = null;
                this.focusName = true;
              } else {
                // move column -> column
                const currentFocus = this.currentFocusColumn.currentFocus;
                if (currentFocus) {
                  focusEnd(this);
                  this.currentFocusColumn = this.focusColumns[index - 1];
                  this.currentFocusColumn.selected = true;
                  this.currentFocusColumn.focus(currentFocus);
                }
              }
            }
          }
        }
        break;
      case "ArrowDown":
        if (this.focusColumns.length !== 0) {
          if (this.currentFocusColumn === null) {
            // move table -> column
            focusEnd(this);
            this.currentFocusColumn = this.focusColumns[0];
            this.currentFocusColumn.selected = true;
            this.currentFocusColumn.focusName = true;
          } else {
            const index = getIndex(
              this.focusColumns,
              this.currentFocusColumn.id
            );
            if (index !== null) {
              if (index === this.focusColumns.length - 1) {
                // move column -> table
                focusEnd(this);
                selectEndColumn(this.focusColumns);
                this.currentFocusColumn = null;
                this.focusName = true;
              } else {
                // move column -> column
                const currentFocus = this.currentFocusColumn.currentFocus;
                if (currentFocus) {
                  focusEnd(this);
                  this.currentFocusColumn = this.focusColumns[index + 1];
                  this.currentFocusColumn.selected = true;
                  this.currentFocusColumn.focus(currentFocus);
                }
              }
            }
          }
        }
        break;
      case "ArrowLeft":
        if (this.currentFocusColumn === null && show.tableComment) {
          // move table -> table
          focusEndColumn(this.focusColumns);
          selectEndColumn(this.focusColumns);
          this.focusName = !this.focusName;
          this.focusComment = !this.focusComment;
        } else if (this.currentFocusColumn) {
          // move column -> column
          this.currentFocusColumn.selected = true;
          this.currentFocusColumn.preFocus();
        }
        break;
      case "ArrowRight":
        if (this.currentFocusColumn === null && show.tableComment) {
          // move table -> table
          focusEndColumn(this.focusColumns);
          selectEndColumn(this.focusColumns);
          this.focusName = !this.focusName;
          this.focusComment = !this.focusComment;
        } else if (this.currentFocusColumn) {
          // move column -> column
          this.currentFocusColumn.selected = true;
          this.currentFocusColumn.nextFocus();
        }
        break;
    }
    this.focusColumnChangeCall = !this.focusColumnChangeCall;
  }

  focus(focusData: FocusData) {
    const { focusTargetTable, focusTargetColumn } = focusData;
    if (focusTargetTable) {
      focusEnd(this);
      selectEndColumn(this.focusColumns);
      this.currentFocusColumn = null;
      if (focusTargetTable.focusType === "tableComment") {
        this.focusComment = true;
      } else {
        this.focusName = true;
      }
    } else if (focusTargetColumn) {
      const targetFocusColumn = getData(
        this.focusColumns,
        focusTargetColumn.columnId
      );
      if (targetFocusColumn) {
        focusEnd(this);
        if (focusTargetColumn.shiftKey && this.currentFocusColumn) {
          // multiple range select
          const currentIndex = getIndex(
            this.focusColumns,
            this.currentFocusColumn.id
          );
          const targetIndex = getIndex(this.focusColumns, targetFocusColumn.id);
          if (currentIndex !== null && targetIndex !== null) {
            range(currentIndex, targetIndex).forEach(index => {
              this.focusColumns[index].selected = true;
            });
          }
        } else if (!focusTargetColumn.ctrlKey) {
          selectEndColumn(this.focusColumns);
        }
        this.currentFocusColumn = targetFocusColumn;
        this.currentFocusColumn.selected = true;
        this.currentFocusColumn.focus(focusTargetColumn.focusType);
      }
    }
  }

  destroy() {
    this.subscriptionList.forEach(sub => sub.unsubscribe());
  }

  private createFocusColumns() {
    const { show } = this.store.canvasState;
    const oldColumnsSize = this.focusColumns.length;
    const columnsSize = this.table.columns.length;
    this.focusColumns = [];
    this.table.columns.forEach(column => {
      this.focusColumns.push(new FocusColumnModel(column, show));
    });
    // currentFocusColumn reload
    if (this.currentFocusColumn?.currentFocus) {
      const targetFocusColumn = getData(
        this.focusColumns,
        this.currentFocusColumn.id
      );
      if (targetFocusColumn) {
        targetFocusColumn.selected = true;
        targetFocusColumn.focus(this.currentFocusColumn.currentFocus);
        this.currentFocusColumn = targetFocusColumn;
      }
    }
    // addColumn focus
    if (oldColumnsSize < columnsSize) {
      focusEnd(this);
      selectEndColumn(this.focusColumns);
      this.currentFocusColumn = this.focusColumns[this.focusColumns.length - 1];
      this.currentFocusColumn.selected = true;
      this.currentFocusColumn.focus("columnName");
    }
  }
}
