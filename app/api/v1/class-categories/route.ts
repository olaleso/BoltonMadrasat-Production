import { d1 } from "@/db";
import {
  actor,
  audit,
  body,
  fail,
  json,
  optional,
  required,
  ApiError,
} from "@/lib/backend";

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  sort_order: number;
  class_count?: number;
  active_class_count?: number;
};

async function first<T>(
  query: string,
  ...bindings: unknown[]
): Promise<T | null> {
  const statement = d1().prepare(query);

  return bindings.length
    ? statement.bind(...bindings).first<T>()
    : statement.first<T>();
}

function cleanName(value: unknown) {
  const name = required(value, "Category name")
    .replace(/\s+/g, " ")
    .trim();

  if (name.length > 80) {
    throw new ApiError(
      400,
      "Category name must be 80 characters or fewer.",
    );
  }

  return name;
}

export async function GET(request: Request) {
  try {
    await actor(request, ["admin", "teacher"]);

    const result = await d1()
      .prepare(
        `select
           cc.*,
           count(c.id) as class_count,
           sum(
             case
               when c.status = 'active' then 1
               else 0
             end
           ) as active_class_count
         from class_categories cc
         left join classes c
           on c.category_id = cc.id
         group by cc.id
         order by
           case when cc.status = 'active' then 0 else 1 end,
           cc.sort_order,
           cc.name`,
      )
      .all<CategoryRow>();

    return json({
      ok: true,
      data: result.results,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const who = await actor(request, ["admin"]);
    const x = await body(request);

    const name = cleanName(x.name);
    const description = optional(x.description);
    const id = crypto.randomUUID();

    const duplicate = await first<CategoryRow>(
      `select *
       from class_categories
       where lower(name) = lower(?)
       limit 1`,
      name,
    );

    if (duplicate) {
      throw new ApiError(
        409,
        duplicate.status === "inactive"
          ? `${name} already exists but is archived. Reactivate it instead.`
          : `${name} already exists.`,
      );
    }

    const maxSort = await first<{ value: number }>(
      `select coalesce(max(sort_order), 0) as value
       from class_categories`,
    );

    const row = await first<CategoryRow>(
      `insert into class_categories
         (
           id,
           name,
           description,
           status,
           sort_order
         )
       values (?, ?, ?, 'active', ?)
       returning *`,
      id,
      name,
      description,
      Number(maxSort?.value ?? 0) + 10,
    );

    await audit(
      who,
      "create-class-category",
      "class_categories",
      id,
      { name },
    );

    return json({
      ok: true,
      data: row,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const who = await actor(request, ["admin"]);
    const x = await body(request);

    const id = required(x.id, "Category");
    const current = await first<CategoryRow>(
      `select *
       from class_categories
       where id = ?
       limit 1`,
      id,
    );

    if (!current) {
      throw new ApiError(404, "Category not found.");
    }

    const name =
      x.name === undefined
        ? current.name
        : cleanName(x.name);

    const description =
      x.description === undefined
        ? current.description
        : optional(x.description);

    const status =
      x.status === undefined
        ? current.status
        : required(x.status, "Status").toLowerCase();

    if (!["active", "inactive"].includes(status)) {
      throw new ApiError(
        400,
        "Category status must be active or inactive.",
      );
    }

    const duplicate = await first<{ id: string }>(
      `select id
       from class_categories
       where lower(name) = lower(?)
         and id <> ?
       limit 1`,
      name,
      id,
    );

    if (duplicate) {
      throw new ApiError(
        409,
        `${name} already exists.`,
      );
    }

    if (
      current.status === "active" &&
      status === "inactive"
    ) {
      const activeClasses = await first<{ total: number }>(
        `select count(*) as total
         from classes
         where category_id = ?
           and status = 'active'`,
        id,
      );

      if (Number(activeClasses?.total ?? 0) > 0) {
        throw new ApiError(
          409,
          "This category still has active classes. Move or archive those classes first.",
        );
      }
    }

    const row = await first<CategoryRow>(
      `update class_categories
       set
         name = ?,
         description = ?,
         status = ?,
         updated_at = CURRENT_TIMESTAMP
       where id = ?
       returning *`,
      name,
      description,
      status,
      id,
    );

    if (name !== current.name) {
      await d1()
        .prepare(
          `update classes
           set
             level = ?,
             updated_at = CURRENT_TIMESTAMP
           where category_id = ?`,
        )
        .bind(name, id)
        .run();
    }

    await audit(
      who,
      "update-class-category",
      "class_categories",
      id,
      {
        fromName: current.name,
        toName: name,
        fromStatus: current.status,
        toStatus: status,
      },
    );

    return json({
      ok: true,
      data: row,
    });
  } catch (error) {
    return fail(error);
  }
}
