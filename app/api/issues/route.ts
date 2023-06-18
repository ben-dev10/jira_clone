import { type NextRequest, NextResponse } from "next/server";
import { type User, prisma } from "@/server/db";
import { IssueType, type Issue, IssueStatus } from "@prisma/client";
import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import {
  calculateInsertPosition,
  filterUserForClient,
  generateIssuesForClient,
} from "@/utils/helpers";

const postIssuesBodyValidator = z.object({
  name: z.string(),
  type: z.enum(["BUG", "STORY", "TASK", "EPIC", "SUBTASK"]),
  sprintId: z.string().nullable(),
  reporterId: z.string().nullable(),
  parentKey: z.string().nullable(),
  sprintColor: z.string().nullable().optional(),
});

export type PostIssueBody = z.infer<typeof postIssuesBodyValidator>;

const patchIssuesBodyValidator = z.object({
  keys: z.array(z.string()),
  type: z.nativeEnum(IssueType).optional(),
  status: z.nativeEnum(IssueStatus).optional(),
  assigneeId: z.string().nullable().optional(),
  reporterId: z.string().optional(),
  parentKey: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  isDeleted: z.boolean().optional(),
});

export type PatchIssuesBody = z.infer<typeof patchIssuesBodyValidator>;

type IssueT = Issue & {
  children: IssueT[];
  sprintIsActive: boolean;
  parent: Issue & {
    sprintIsActive: boolean;
    children: IssueT[];
    parent: null;
    assignee: User | null;
    reporter: User | null;
  };
  assignee: User | null;
  reporter: User | null;
};

export type GetIssuesResponse = {
  issues: IssueT[];
};

export async function GET() {
  // return NextResponse.json<GetIssuesResponse>({ issues: activeIssues });
  const activeIssues = await prisma.issue.findMany({
    where: {
      isDeleted: false,
    },
  });
  if (!activeIssues) {
    return NextResponse.json({ issues: [] });
  }

  const activeSprints = await prisma.sprint.findMany({
    where: {
      status: "ACTIVE",
    },
  });

  const userIds = activeIssues
    .flatMap((issue) => [issue.assigneeId, issue.reporterId] as string[])
    .filter(Boolean);

  const users = (
    await clerkClient.users.getUserList({
      userId: userIds,
      limit: 20,
    })
  ).map(filterUserForClient);

  const issuesForClient = generateIssuesForClient(
    activeIssues,
    users,
    activeSprints.map((sprint) => sprint.id)
  );
  // const issuesForClient = await getIssuesFromServer();
  return NextResponse.json({ issues: issuesForClient });
}

// POST
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();

  const validated = postIssuesBodyValidator.safeParse(body);

  if (!validated.success) {
    const message =
      "Invalid body. " + (validated.error.errors[0]?.message ?? "");
    return new Response(message, { status: 400 });
  }

  const { data: valid } = validated;

  const issues = await prisma.issue.findMany();
  const currentSprintIssues = await prisma.issue.findMany({
    where: {
      sprintId: valid.sprintId,
      isDeleted: false,
    },
  });

  const sprint = await prisma.sprint.findUnique({
    where: {
      id: valid.sprintId ?? "",
    },
  });

  let boardPosition = -1;

  if (sprint && sprint.status === "ACTIVE") {
    const issuesInColum = currentSprintIssues.filter(
      (issue) => issue.status === "TODO"
    );
    boardPosition = calculateInsertPosition(issuesInColum);
  }

  const k = issues.length + 1;

  const positionToInsert = calculateInsertPosition(currentSprintIssues);

  const issue = await prisma.issue.create({
    data: {
      key: `ISSUE-${k}`,
      name: valid.name,
      type: valid.type,
      reporterId: valid.reporterId ?? "user_2PwZmH2xP5aE0svR6hDH4AwDlcu", // Rogan as default reporter
      sprintId: valid.sprintId ?? undefined,
      sprintPosition: positionToInsert,
      boardPosition,
      parentKey: valid.parentKey,
      sprintColor: valid.sprintColor,
    },
  });
  // return NextResponse.json<PostIssueResponse>({ issue });
  return NextResponse.json({ issue });
}

export async function PATCH(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  const validated = patchIssuesBodyValidator.safeParse(body);

  if (!validated.success) {
    // eslint-disable-next-line
    const message = "Invalid body. " + validated.error.errors[0]?.message ?? "";
    return new Response(message, { status: 400 });
  }

  const { data: valid } = validated;

  const issuesToUpdate = await prisma.issue.findMany({
    where: {
      key: {
        in: valid.keys,
      },
    },
  });

  const updatedIssues = await Promise.all(
    issuesToUpdate.map(async (issue) => {
      return await prisma.issue.update({
        where: {
          id: issue.id,
        },
        data: {
          type: valid.type ?? undefined,
          status: valid.status ?? undefined,
          assigneeId: valid.assigneeId ?? undefined,
          reporterId: valid.reporterId ?? undefined,
          isDeleted: valid.isDeleted ?? undefined,
          sprintId: valid.sprintId === undefined ? undefined : valid.sprintId,
          parentKey: valid.parentKey ?? undefined,
        },
      });
    })
  );

  // return NextResponse.json<PostIssueResponse>({ issue });
  return NextResponse.json({ issues: updatedIssues });
}
