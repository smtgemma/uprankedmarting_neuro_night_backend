export type IPaginationOptions = {
    page?: number;
    limit?: number;
    sortBy?: string | undefined;
    sortOrder?: string | undefined;
}

// Pagination result
type IOptionsResult = {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
};

const calculatePagination = (options: IPaginationOptions): IOptionsResult => {
  const page: number = Number(options.page) || 1;
  const limit: number = Number(options.limit) || 10;
  const skip: number = (page - 1) * limit;

  const sortBy: string = options.sortBy || "createdAt";
  const sortOrder: "asc" | "desc" =
    options.sortOrder === "asc" ? "asc" : "desc"; // enforce valid values

  return {
    page,
    limit,
    skip,
    sortBy,
    sortOrder,
  };
};

export const paginationHelper = {
  calculatePagination,
};
