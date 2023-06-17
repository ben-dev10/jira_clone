import { SignInButton, useUser } from "@clerk/nextjs";
import { FaChevronUp } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Fragment, useState } from "react";
import { type IssueType } from "@/utils/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar } from "@/components/avatar";
import { useSprints } from "@/hooks/query-hooks/use-sprints";
import { IssueAssigneeSelect } from "../../issue-select-assignee";
import { useIssues } from "@/hooks/query-hooks/use-issues";
import { type UserResource } from "@clerk/types";
import { useFullURL } from "@/hooks/use-full-url";

const IssueDetailsInfoAccordion: React.FC<{ issue: IssueType }> = ({
  issue,
}) => {
  const { updateIssue } = useIssues();
  const { sprints } = useSprints();
  const { user } = useUser();
  const [openAccordion, setOpenAccordion] = useState("details");

  function handleAutoAssign() {
    if (!user) return;

    updateIssue({
      issue_key: issue.key,
      assigneeId: user.id,
    });
  }
  return (
    <Accordion
      onValueChange={setOpenAccordion}
      value={openAccordion}
      className="my-3 w-min min-w-full rounded-[3px] border"
      type="single"
      collapsible
    >
      <AccordionItem value={"details"}>
        <AccordionTrigger className="flex w-full items-center justify-between p-2 font-medium hover:bg-gray-100 [&[data-state=open]>svg]:rotate-180 [&[data-state=open]]:border-b">
          <div className="flex items-center gap-x-1">
            <span className="text-sm">Details</span>
            <span className="text-xs text-gray-500">
              (Assignee, Sprint, Reporter)
            </span>
          </div>
          <FaChevronUp
            className="mr-2 text-xs text-black transition-transform"
            aria-hidden
          />
        </AccordionTrigger>
        <AccordionContent className="flex flex-col bg-white px-3 [&[data-state=open]]:py-2">
          <div
            data-state={issue.assignee ? "assigned" : "unassigned"}
            className="my-2 grid grid-cols-3 [&[data-state=assigned]]:items-center"
          >
            <span className="text-sm font-semibold text-gray-600">
              Assignee
            </span>
            <div className="flex flex-col">
              <IssueAssigneeSelect issue={issue} />
              <AssignToMeButton
                key={user?.id}
                issue={issue}
                user={user}
                onClick={handleAutoAssign}
              />
            </div>
          </div>
          <div className="my-4 grid grid-cols-3 items-center">
            <span className="text-sm font-semibold text-gray-600">Sprint</span>
            <div className="flex items-center">
              <span className="text-sm text-gray-700">
                {sprints?.find((sprint) => sprint?.id == issue.sprintId)
                  ?.name ?? "None"}
              </span>
            </div>
          </div>
          <div className="my-2 grid grid-cols-3  items-center">
            <span className="text-sm font-semibold text-gray-600">
              Reporter
            </span>
            <div className="flex items-center gap-x-3 ">
              <Avatar
                src={issue.reporter?.avatar}
                alt={`${issue.reporter?.name ?? "Unassigned"}`}
              />
              <span className="whitespace-nowrap text-sm">
                {issue.reporter?.name}
              </span>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

const AssignToMeButton: React.FC<{
  issue: IssueType;
  user: UserResource | null | undefined;
  onClick: () => void;
}> = ({ user, issue, onClick }) => {
  const [url] = useFullURL();
  return (
    <Fragment>
      {user?.id ? (
        <Button
          onClick={onClick}
          data-state={issue.assignee ? "assigned" : "unassigned"}
          customColors
          customPadding
          className="mt-1 hidden text-sm text-blue-600 underline-offset-2 hover:underline [&[data-state=unassigned]]:flex"
        >
          Assign to me
        </Button>
      ) : (
        <SignInButton mode="modal" redirectUrl={url}>
          <button
            data-state={issue.assignee ? "assigned" : "unassigned"}
            className="mt-1 hidden text-sm text-blue-600 underline-offset-2 hover:underline [&[data-state=unassigned]]:flex"
          >
            Assign to me
          </button>
        </SignInButton>
      )}
    </Fragment>
  );
};

export { IssueDetailsInfoAccordion };
