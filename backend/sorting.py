
def merge_sort(routes):
    if len(routes) <= 1:
        return routes

    mid = len(routes) // 2

    left = merge_sort(routes[:mid])
    right = merge_sort(routes[mid:])

    return merge(left, right)


def merge(left, right):
    result = []
    i = 0
    j = 0

    while i < len(left) and j < len(right):
        if left[i]["total_cost"] <= right[j]["total_cost"]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1

    while i < len(left):
        result.append(left[i])
        i += 1

    while j < len(right):
        result.append(right[j])
        j += 1

    return result
