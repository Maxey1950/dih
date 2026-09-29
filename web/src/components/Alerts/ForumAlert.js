export default function ForumBetaAlert() {
    return (
      <div className="alert alert-info border-0 shadow-sm rounded-3 p-3 mb-4">
        <div className="d-flex align-items-center gap-2 mb-1">
          <i className="bi bi-info-circle-fill text-info fs-5"></i>
          <h5 className="alert-heading fw-bold mb-0 text-body">Notice</h5>
        </div>
        <p className="mb-0 ms-4 text-body-secondary small">
          This is a beta version of the forum. We are currently working on improving the forum and adding more features. Please report any bugs or issues in the Help Center forum section.
        </p>
      </div>
    );
  }